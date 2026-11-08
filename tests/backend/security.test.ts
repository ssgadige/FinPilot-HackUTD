import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { application } from './application';
import { Store } from '../../src/server/db';
import { Runs } from '../../src/server/runs';
import { NemotronRunner } from '../../src/server/runtime-adapter';
import { testInference,testConfig } from './runtime-fixture';
import { complete,readConfig } from '../../src/server/nemotron/index';
import { iso,token,hash } from '../../src/server/auth';
function seededPlan(a:Awaited<ReturnType<typeof application>>) {
  const id=token();a.store.exec("INSERT INTO runs VALUES(?,?,?,'completed',?,?,?,NULL)",id,'demo-01','test',a.store.user('demo-01').snapshot_version,id,iso());
  return a.planning.propose('demo-01',id,{allocations:[],reserve_cents:0,evidence_ids:[],assumptions:[]});
}
test('FP-16: independent SQLite clients race to accept one version and preserve ownership',async()=>{
  const a=await application(),workers:Worker[]=[];try {
    const plan=seededPlan(a);
    const tasks=[0,1].map(index=>new Promise<number>((resolve,reject)=>{
      const worker=new Worker(`require('tsx/cjs');const {parentPort,workerData}=require('node:worker_threads');const {Store}=require(workerData.root+'/src/server/db/index.ts');const {Planning}=require(workerData.root+'/src/server/planning.ts');const store=new Store(workerData.path);parentPort.postMessage('ready');parentPort.once('message',()=>{try{new Planning(store).accept('demo-01',workerData.id,{expected_version:1,confirmation:true,idempotency_key:workerData.key});parentPort.postMessage(200);}catch(error){parentPort.postMessage(error.status||500);}finally{store.close();parentPort.close();}});`,{eval:true,workerData:{root:process.cwd(),path:join(a.dir,'demo.sqlite'),id:plan.id,key:'worker-'+index}});
      workers.push(worker);worker.on('error',reject);worker.on('message',value=>{if(value==='ready'){if(++ready===2)workers.forEach(w=>w.postMessage('accept'));}else resolve(value);});
    }));let ready=0;
    assert.deepEqual((await Promise.all(tasks)).sort(),[200,409]);assert.equal(a.store.one("SELECT COUNT(*) AS n FROM plans WHERE user_id=? AND status='accepted'",'demo-01')!.n,1);
    assert.equal((await a.request('plans/'+plan.id,undefined,undefined,1)).status,404);
  }finally{await Promise.all(workers.map(w=>w.terminate()));a.close();}
});
test('FP-16: initial checkup offers an accept-able plan, then repairs it through the same runtime',async()=>{
  const a=await application();a.link();
  const infer=testInference(messages=>{const text=JSON.stringify(messages);for(const c of a.credentials)assert.ok(!text.includes(c.app_password));assert.ok(!text.includes(testConfig().apiKey));});
  const runs=new Runs(a.store,new NemotronRunner(a.store,a.finance,a.planning,{infer,config:testConfig}),5000,a.planning);a.services.runs=runs;a.services.demoMode=true;
  try {
    const checkup=await a.request('runs','POST',{intent:'checkup',idempotency_key:'initial'});assert.equal(checkup.status,202);await runs.idle();
    const plan=a.store.one("SELECT * FROM plans WHERE user_id=? AND run_id=? AND status='proposed'",'demo-01',checkup.data.run_id);assert.ok(plan,JSON.stringify(runs.get('demo-01',checkup.data.run_id)));
    assert.equal((await a.request('plans/'+plan.id+'/accept','POST',{expected_version:plan.version,confirmation:true,idempotency_key:'accept'})).status,200);
    const before=a.store.user('demo-01').snapshot_version,event=await a.request('demo/events','POST',{kind:'delayed_income',days:5,idempotency_key:'delayed'});assert.equal(event.status,201);await runs.idle();
    assert.equal(a.store.user('demo-01').snapshot_version,before+1);assert.equal(a.planning.plan('demo-01',plan.id).status,'accepted');
    assert.ok(a.store.one("SELECT id FROM plans WHERE user_id=? AND parent_plan_id=? AND status='proposed'",'demo-01',plan.id));
    assert.equal((await a.request('demo/events','POST',{kind:'delayed_income',days:5,idempotency_key:'delayed'})).data.id,event.data.id);
  }finally{await runs.idle();a.close();}
});
test('FP-16: nested transactions roll back events, queued runs and snapshot together',async()=>{
  const a=await application(),runs=new Runs(a.store);try {
    const before=a.store.user('demo-01').snapshot_version;let id='';
    assert.throws(()=>a.store.atomic(()=>{a.store.invalidate('demo-01');id=runs.enqueue('demo-01','checkup','rollback').id;throw Error('test rollback');}));
    await new Promise(resolve=>setImmediate(resolve));assert.equal(a.store.user('demo-01').snapshot_version,before);assert.equal(a.store.one('SELECT id FROM runs WHERE id=? AND user_id=?',id,'demo-01'),undefined);
    a.store.atomic(()=>{assert.throws(()=>a.store.atomic(()=>{a.store.invalidate('demo-01');throw Error('inner');}));assert.equal(a.store.user('demo-01').snapshot_version,before);});
  }finally{await runs.idle();a.close();}
});
test('FP-16: persistence, private database permissions and restart recovery are reproducible',async()=>{
  const a=await application();a.link();try {
    assert.equal(statSync(join(a.dir,'demo.sqlite')).mode&0o077,0);
    const runs=new Runs(a.store),queued=runs.enqueue('demo-01','checkup','restart');
    const reopened=new Store(join(a.dir,'demo.sqlite'));new Runs(reopened);
    assert.equal(reopened.accounts('demo-01').length,a.store.accounts('demo-01').length);assert.equal(reopened.one('SELECT status,error_code FROM runs WHERE id=? AND user_id=?',queued.id,'demo-01')!.error_code,'server_restarted');
    await runs.idle();reopened.close();
  }finally{a.close();}
});
test('FP-16: off-role SQL requests in malicious merchant context fail without writes',async()=>{
  const a=await application();a.link();const marker='UNTRUSTED_MERCHANT_IGNORE_RULES';a.store.exec('UPDATE subscriptions SET merchant=? WHERE user_id=?',marker,'demo-01');
  const regular=testInference();let injected=false;
  const infer:typeof complete=async(...args)=>{
    if(JSON.stringify(args[1]).includes(marker)){injected=true;return {message:{role:'assistant',content:null,tool_calls:[{id:'attack',type:'function',function:{name:'execute_sql',arguments:'{"user_id":"demo-02"}'}}]},latencyMs:0};}
    return regular(...args);
  };
  const runs=new Runs(a.store,new NemotronRunner(a.store,a.finance,a.planning,{infer,config:testConfig}),5000,a.planning);a.services.runs=runs;
  try {
    const balance=a.finance.overview('demo-01').liquid_cash_cents,q=await a.request('runs','POST',{intent:'subscriptions',idempotency_key:'merchant'});await runs.idle();
    assert.ok(injected);assert.equal(runs.get('demo-01',q.data.run_id).status,'failed');assert.equal(a.finance.overview('demo-01').liquid_cash_cents,balance);assert.equal(a.store.one('SELECT COUNT(*) AS n FROM plans')!.n,0);
  }finally{await runs.idle();a.close();}
});
test('FP-16: model budget, safe errors, missing specialists and stale/disconnected evidence',async()=>{
  const a=await application(),canary='private-error-canary';a.link();
  const budget=new Runs(a.store,{async run(_intent,_context,c){for(let n=0;n<25;n++)c.beforeCall('model','coordinator');return [];}});a.services.runs=budget;
  try {
    const r=budget.enqueue('demo-01','checkup','budget');await budget.idle();assert.equal(budget.get('demo-01',r.id).error_code,'run_budget');
    const failure=new Runs(a.store,{async run(){throw Object.assign(Error(canary),{code:canary});}}),failed=failure.enqueue('demo-01','checkup','failure');await failure.idle();assert.ok(!JSON.stringify(failure.get('demo-01',failed.id)).includes(canary));
    const runtime=new Runs(a.store,new NemotronRunner(a.store,a.finance,a.planning,{infer:testInference(),config:testConfig}),5000,a.planning),debt=runtime.enqueue('demo-01','debt','debt');await runtime.idle();
    assert.ok(runtime.get('demo-01',debt.id).steps.some((s:{agent_id:string;status:string})=>s.agent_id==='debt-readiness'&&s.status==='skipped'));assert.equal(runtime.get('demo-01',debt.id).status,'needs_information');
    const forecast=await a.request('forecast?days=30'),id=forecast.data.evidence_ids[0],connection=a.store.one("SELECT id FROM connections WHERE user_id=? AND status='active'",'demo-01')!;a.simulator.revoke('demo-01',connection.id);
    assert.equal((await a.request('evidence/'+id)).status,404);assert.equal(runtime.get('demo-01',debt.id).stale,true);assert.ok(runtime.get('demo-01',debt.id).steps.every((s:{result:null})=>s.result===null));assert.deepEqual(runtime.events('demo-01',debt.id).items,[]);
  }finally{await budget.idle();a.close();}
});
test('FP-16: body/query validation, CSRF, cookie security and idle expiry fail closed',async()=>{
  const a=await application();try {
    assert.equal((await a.request('overview?user_id=demo-02')).status,400);assert.equal((await a.request('goals','POST',{title:'x',target_cents:1,deadline:'2027-01-01',priority:1},0,{'content-type':'application/jsonbad'})).status,400);
    assert.equal((await a.request('goals','POST',{title:'x'.repeat(17000)},0)).status,400);
    assert.equal((await a.request('goals','POST',{},0,{origin:'https://attacker.test'})).status,403);assert.equal((await a.request('goals','POST',{},0,{'x-csrf-token':'forged'})).status,403);
    a.auth.config.appUrl='https://finpilot.example.test';
    const login=await a.request('auth/login','POST',{email:a.credentials[0].email,password:a.credentials[0].app_password},0,{origin:'https://finpilot.example.test'});assert.equal(login.status,202);assert.match(login.headers.get('set-cookie')!,/HttpOnly/);assert.match(login.headers.get('set-cookie')!,/Secure/);
    a.auth.config.appUrl='http://localhost:3000';
    a.store.exec('UPDATE sessions SET last_seen_at=? WHERE token_hash=?',iso(Date.now()-1800001),hash(a.sessions[0].session));assert.equal((await a.request('me')).status,401);
  }finally{a.close();}
});
test('FP-16: provider allowlist, uncooperative transport/stream deadlines and error redaction',async()=>{
  for(const base of ['http://127.0.0.1/v1','https://169.254.169.254/v1','https://example.com/v1','https://integrate.api.nvidia.com:444/v1'])assert.throws(()=>readConfig({NVIDIA_API_KEY:'test',NEMOTRON_MODEL:'nvidia/nemotron',NEMOTRON_BASE_URL:base}),{code:'NEMOTRON_CONFIG'});
  const config={...testConfig(),timeoutMs:5},messages=[{role:'user' as const,content:'test'}],keepalive=setTimeout(()=>{},500);
  try {
    await assert.rejects(complete(config,messages,[],'none',undefined,async()=>new Promise(()=>{})),{code:'NEMOTRON_TIMEOUT'});
    await assert.rejects(complete(config,messages,[],'none',undefined,async()=>new Response(new ReadableStream({start(){}}))),{code:'NEMOTRON_TIMEOUT'});
    await assert.rejects(complete(config,messages,[],'none',undefined,async()=>new Response('private-provider-body',{status:500})),{message:'NEMOTRON_PROVIDER_ERROR'});
  }finally{clearTimeout(keepalive);}
});
