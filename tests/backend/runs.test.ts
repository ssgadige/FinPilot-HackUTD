import { test } from 'node:test';
import assert from 'node:assert/strict';
import { application } from './application';
import { Runs, type RunOptions } from '../../src/server/runs';
import { Store } from '../../src/server/db';
import { Auth, token, iso } from '../../src/server/auth';
import { createApi } from '../../src/server/api';
import { NemotronError, type complete } from '../../src/server/nemotron';
import type { AgentResult } from '../../contracts/types';
import { runAgent, RunBudget } from '../../src/server/agents/runtime';
const config=()=>({apiKey:'test-provider-secret',baseUrl:'https://example.test',model:'nvidia/nemotron',timeoutMs:30000});
function model(inspect?:(messages:Parameters<typeof complete>[1])=>void):typeof complete {
  return async(_config,messages,available)=>{
    inspect?.(messages);
    if(available?.length){
      const name=available[0].function.name;
      return {latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:token(),type:'function',function:{name,arguments:JSON.stringify({scope:'snapshot',...(name==='route_specialists'?{specialists:['cash-collision']}:{})})}}]}};
    }
    const system=messages[0].content!;
    const role=system.match(/Your agent_id is ([^;]+);/)![1] as AgentResult['agent_id'];
    const snapshot=Number(system.match(/snapshot_version is (\d+)/)![1]);
    const outputs=messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content!));
    const ids=[...new Set<string>(outputs.flatMap(o=>o.evidence.map((e:{id:string})=>e.id)))];
    const needs=role==='plan-repair'||outputs.some(o=>o.needsInformation);
    const result:AgentResult={agent_id:role,status:needs?'needs_information':'completed',headline:'Scoped financial analysis.',
      findings:ids.length?[{id:'review',severity:'info',summary:'Review the scoped calculation.',evidence_ids:[ids[0]],amount_cents:null}]:[],
      evidence_ids:ids,assumptions:[],missing_data:needs?['Application planning metadata requires confirmation.']:[],proposed_actions:[],snapshot_version:snapshot,
      ...(role==='coordinator'?{selected_specialists:['cash-collision']}:{})};
    return {latencyMs:1,message:{role:'assistant',content:JSON.stringify(result)}};
  };
}
async function setup(options:RunOptions={}){
  const a=await application();const runs=new Runs(a.store,a.auth,a.finance,a.planning,{config,infer:model(),demoMode:true,...options});
  a.services.runs=runs;
  return {...a,runs,async finish(){await runs.close();a.close();}};
}
const checkup=(key='checkup')=>({intent:'cash',idempotency_key:key});

test('FP-16: disconnect after a tool result stops the next provider call from using cached data',async()=>{
  const a=await setup();let calls=0;
  try{
    const connections=a.link();const context=a.runs.bridge.contextFor('demo-01','disconnect-between-calls');
    const budget=new RunBudget();
    const result=await runAgent({role:'data-integrity',context,config:config(),budget,
      tools:a.runs.bridge.toolsFor('data-integrity')!,infer:model(()=>{calls++;}),
      beforeModelCall:(ctx)=>a.runs.bridge.authorize(ctx),
      onToolOutput:()=>{a.simulator.revoke('demo-01',connections[0].id);}});
    assert.equal(result.result.status,'failed');assert.equal(calls,1);assert.equal(budget.calls,1);
    assert.ok(result.events.some(e=>e.type==='failed'&&e.message==='SNAPSHOT_SCOPE'));
  }finally{await a.finish();}
});
function acceptBaseline(a:Awaited<ReturnType<typeof setup>>){
  const uid='demo-01',run=token();a.store.exec("INSERT INTO runs VALUES(?,?,?,'completed',?,?,?,NULL)",run,uid,'calculation',a.store.user(uid).snapshot_version,run,iso());
  const goal=a.store.one('SELECT id FROM goals WHERE user_id=?',uid)!;
  const p=a.planning.propose(uid,run,{allocations:[{kind:'goal_contribution',target_id:goal.id,monthly_cents:1200,day_of_month:10}],reserve_cents:10000,evidence_ids:[],assumptions:['Synthetic baseline']});
  return a.planning.accept(uid,p.id,{expected_version:p.version,confirmation:true,idempotency_key:'baseline'});
}

test('FP-15: authenticated 202, persisted steps/events/evidence, incremental polling, replay, ownership and stale redaction',async()=>{
  let calls=0;const a=await setup({infer:model(()=>{calls++;})});
  try{
    a.link();a.link(1);
    const first=await a.request('runs','POST',checkup());assert.equal(first.status,202);assert.equal(first.data.status,'queued');
    const id=first.data.run_id;
    const replay=await a.request('runs','POST',checkup());assert.equal(replay.data.run_id,id);
    assert.equal((await a.request('runs','POST',{...checkup(),intent:'full'})).status,409);
    await a.runs.drain();
    const view=await a.request('runs/'+id);assert.equal(view.status,200);assert.equal(view.data.status,'completed');assert.equal(view.data.model_calls,12);assert.equal(calls,12);
    assert.deepEqual(view.data.role_steps.filter((s:{status:string})=>s.status==='completed').map((s:{role:string})=>s.role),['data-integrity','cash-collision']);
    assert.ok(view.data.findings.length>0);assert.ok(view.data.trace.length>0);
    const events=await a.request('runs/'+id+'/events');assert.ok(events.data.items.some((e:{type:string})=>e.type==='tool_completed'));
    assert.deepEqual((await a.request('runs/'+id+'/events?cursor='+events.data.next_cursor)).data.items,[]);
    assert.equal((await a.request('runs/'+id+'/events?cursor=bad')).status,400);
    for(const path of ['runs/'+id,'runs/'+id+'/events'])assert.equal((await a.request(path,'GET',undefined,1)).status,404);
    assert.equal((await a.request('runs/'+id+'/cancel','POST',{},1)).status,404);
    const evidence=a.store.one('SELECT id FROM evidence WHERE run_id=?',id)!;
    assert.equal((await a.request('evidence/'+evidence.id)).status,200);assert.equal((await a.request('evidence/'+evidence.id,'GET',undefined,1)).status,404);
    a.store.invalidate('demo-01');
    const stale=await a.request('runs/'+id);assert.equal(stale.data.stale,true);assert.deepEqual(stale.data.findings,[]);assert.deepEqual(stale.data.trace,[]);
    assert.equal((await a.request('evidence/'+evidence.id)).status,404);
    assert.equal((await a.request('runs','POST',checkup())).data.run_id,id);assert.equal(calls,12);
    const second=new Store(a.dir+'/demo.sqlite');try{assert.equal(second.one('SELECT status FROM runs WHERE id=? AND user_id=?',id,'demo-01')!.status,'completed');}finally{second.close();}
  }finally{await a.finish();}
});

test('FP-15: cancellation aborts in-flight inference and prevents new tools/calls, including queued cancellation',async()=>{
  let entered!:()=>void,release!:()=>void,calls=0;
  const started=new Promise<void>(r=>entered=r),blocked=new Promise<void>(r=>release=r);
  const a=await setup({infer:async()=>{calls++;entered();await blocked;throw Error('provider-private-body');}});
  try{
    a.link();const run=await a.request('runs','POST',checkup());await started;
    assert.equal((await a.request('runs/'+run.data.run_id+'/cancel','POST')).data.status,'cancelled');
    await a.runs.drain();release();assert.equal(calls,1);
    const events=a.runs.events('demo-01',run.data.run_id).items;assert.ok(!events.some(e=>e.type==='tool_started'));
    const next=await a.request('runs','POST',checkup('cancel-queued'));a.runs.cancel('demo-01',next.data.run_id);await a.runs.drain();assert.equal(calls,1);
    assert.equal(a.runs.view('demo-01',run.data.run_id).status,'cancelled');
  }finally{release();await a.finish();}
});

test('FP-15/16: strict fields, password/email sessions, CSRF, run budgets and honest provider failure',async()=>{
  const a=await setup({infer:async()=>{throw new NemotronError('NEMOTRON_TIMEOUT',502);}});
  try{
    a.link();
    assert.equal((await a.request('runs','POST',checkup(),0,{cookie:''})).status,401);
    const challenge=await a.auth.login(a.credentials[0].email,a.credentials[0].app_password,'test-pending');
    assert.equal((await a.request('runs','POST',checkup(),0,{cookie:'fp_pending='+challenge.pending})).status,401);
    assert.equal((await a.request('runs','POST',checkup(),0,{'x-csrf-token':'wrong'})).status,403);
    assert.equal((await a.request('runs','POST',checkup(),0,{origin:'https://foreign.example'})).status,403);
    for(const path of ['runs','chat','demo/events']){
      const input=path==='runs'?checkup():path==='chat'?{message:'Explain findings.'}:{kind:'surprise_expense',amount_cents:1,idempotency_key:'bad'};
      assert.equal((await a.request(path,'POST',{...input,user_id:'demo-02'})).status,400);
    }
    assert.equal((await a.request('runs','POST',{...checkup(),intent:'arbitrary-tool'})).status,400);
    const run=await a.request('runs','POST',checkup());assert.equal((await a.request('runs','POST',checkup('busy'))).status,429);await a.runs.drain();
    const view=a.runs.view('demo-01',run.data.run_id);assert.equal(view.status,'failed');assert.equal(view.error_code,'provider_or_validation_failure');assert.ok(!JSON.stringify(view).includes('provider-private-body'));
    a.runs.options.infer=async()=>({latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:'identity-attack',type:'function',function:{name:'route_specialists',arguments:JSON.stringify({scope:'snapshot',specialists:['cash-collision'],user_id:'demo-02'})}}]}});
    const attack=await a.request('runs','POST',checkup('model-identity'));await a.runs.drain();
    assert.equal(a.runs.view('demo-01',attack.data.run_id).status,'failed');
    assert.ok(!a.runs.events('demo-01',attack.data.run_id).items.some(e=>e.type==='tool_started'));
    for(let n=0;n<10;n++)a.auth.throttle('agent-run:demo-01',100,3600000);
    assert.equal((await a.request('runs','POST',checkup('limited'))).status,429);
    a.runs.options.config=()=>{throw Error('private missing key detail');};
    assert.equal((await a.request('runs','POST',checkup('missing'))).status,503);
    assert.equal((await a.request('chat','POST',{message:'Explain.'})).status,503);
    const count=a.store.one('SELECT COUNT(*) AS n FROM demo_events')!.n;
    assert.equal((await a.request('demo/events','POST',{kind:'surprise_expense',amount_cents:1,idempotency_key:'missing'})).status,503);
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM demo_events')!.n,count);
  }finally{await a.finish();}
});

test('FP-16: HTTPS cookies are Secure and sessions enforce idle and absolute expiry',async()=>{
  const a=await application();let now=Date.now(),code='';
  const auth=new Auth(a.store,{secret:'https-isolated-test-secret-'.repeat(3),appUrl:'https://finpilot.test',allowLocalHttp:false},{async send(_email,value){code=value;}},()=>now);
  const api=createApi({store:a.store,auth});
  const request=(path:string,body:unknown,cookie='')=>api(new Request('https://finpilot.test/api/v1/'+path,{method:'POST',headers:{origin:'https://finpilot.test','content-type':'application/json',cookie},body:JSON.stringify(body)}));
  try{
    const login=await request('auth/login',{email:a.credentials[0].email,password:a.credentials[0].app_password});assert.equal(login.status,202);
    const challenge=await login.json();const pending=login.headers.getSetCookie().find(c=>c.startsWith('fp_pending='))!.split(';')[0];
    const verify=await request('auth/verify',{challenge_id:challenge.challenge_id,code},pending);assert.equal(verify.status,200);
    const cookies=verify.headers.getSetCookie();assert.ok(cookies.filter(c=>c.startsWith('fp_session=')||c.startsWith('fp_csrf=')).every(c=>c.includes('; Secure')));
    const session=cookies.find(c=>c.startsWith('fp_session='))!.match(/^fp_session=([^;]+)/)![1];
    now+=30*60*1000;assert.throws(()=>auth.session(session),{code:'unauthenticated'});
    const second=await auth.login(a.credentials[0].email,a.credentials[0].app_password,'https-test');const signed=auth.verify(second.challenge_id,code,second.pending);
    for(let n=0;n<16;n++){now+=29*60*1000;auth.session(signed.session);}
    now+=17*60*1000;assert.throws(()=>auth.session(signed.session),{code:'unauthenticated'});
  }finally{a.close();}
});

test('FP-15: expense event is atomic/idempotent, repairs the real plan store, preserves accepted baseline and requires confirmation',async()=>{
  const a=await setup();
  try{
    a.link();const baseline=acceptBaseline(a);const payload=a.planning.plan('demo-01',baseline.id).payload_json;
    const original=a.finance.overview('demo-01');
    const input={kind:'surprise_expense',amount_cents:200000,idempotency_key:'expense'};
    const responses=await Promise.all([a.request('demo/events','POST',input),a.request('demo/events','POST',input)]);
    assert.ok(responses.every(r=>r.status===202));assert.equal(responses[0].data.event_id,responses[1].data.event_id);
    assert.equal(a.finance.overview('demo-01').liquid_cash_cents,original.liquid_cash_cents-200000);
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM demo_events')!.n,1);
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM accounts a WHERE a.balance_cents!=a.opening_cents+(SELECT COALESCE(SUM(delta_cents),0) FROM transactions t WHERE t.account_id=a.id AND t.user_id=a.user_id)')!.n,0);
    assert.equal((await a.request('demo/events','POST',{...input,amount_cents:1})).status,409);
    await a.runs.drain();const run=a.runs.view('demo-01',responses[0].data.run_id);
    assert.equal(run.status,'completed');assert.equal(run.partial,true);assert.ok(run.proposed_plan_id);
    const proposed=a.planning.plan('demo-01',run.proposed_plan_id!);assert.equal(proposed.parent_plan_id,baseline.id);assert.equal(proposed.status,'proposed');
    assert.equal(a.planning.plan('demo-01',baseline.id).status,'accepted');assert.equal(a.planning.plan('demo-01',baseline.id).payload_json,payload);
    assert.deepEqual(JSON.parse(proposed.payload_json).allocations,[]);
    assert.equal((await a.request('plans/'+proposed.id+'/accept','POST',{expected_version:proposed.version,confirmation:false,idempotency_key:'no'})).status,400);
    assert.equal((await a.request('plans/'+proposed.id+'/accept','POST',{expected_version:proposed.version,confirmation:true,idempotency_key:'accept-repair'})).status,200);
    assert.equal(a.planning.plan('demo-01',baseline.id).status,'superseded');
    const beforeReplay=a.store.user('demo-01').snapshot_version;
    assert.equal((await a.request('demo/events','POST',input)).data.run_id,run.run_id);assert.equal(a.store.user('demo-01').snapshot_version,beforeReplay);
    a.runs.options.demoMode=false;assert.equal((await a.request('demo/events','POST',{...input,idempotency_key:'disabled'})).status,403);
  }finally{await a.finish();}
});

test('FP-15: delay targets a scoped income occurrence once; forecasts/tools agree and foreign users are unchanged',async()=>{
  const a=await setup();
  try{
    a.link();a.link(1);const uid='demo-01';const before=a.finance.forecast(uid,90);const other=a.finance.forecast('demo-02',90);
    const input={kind:'delayed_income',days:7,idempotency_key:'delay'};
    const event=await a.request('demo/events','POST',input);assert.equal(event.status,202);await a.runs.drain();
    const payload=JSON.parse(a.store.one('SELECT payload_json FROM demo_events WHERE id=? AND user_id=?',event.data.event_id,uid)!.payload_json);
    const ctx=a.runs.bridge.contextFor(uid,'compare');const snapshot=await a.runs.bridge.legacy(ctx);
    const shifted=snapshot.scheduled.find(s=>s.id===payload.scheduled_item_id)!;assert.equal(shifted.date,payload.delayed_date);
    const income=a.store.one('SELECT amount_cents FROM scheduled_items WHERE id=? AND user_id=?',payload.scheduled_item_id,uid)!.amount_cents;
    const after=a.finance.forecast(uid,90);
    assert.equal(after.dated_balances.find(r=>r.date===payload.original_date)!.balance_cents,before.dated_balances.find(r=>r.date===payload.original_date)!.balance_cents-income);
    assert.equal(after.dated_balances.at(-1)!.balance_cents,before.dated_balances.at(-1)!.balance_cents);
    assert.deepEqual(a.finance.forecast('demo-02',90).dated_balances,other.dated_balances);
    assert.equal((await a.request('demo/events','POST',input)).data.event_id,event.data.event_id);
    assert.deepEqual(a.finance.forecast(uid,90).dated_balances,after.dated_balances);
    const connection=a.store.one('SELECT connection_id AS id FROM connection_accounts WHERE account_id=? AND user_id=?',payload.account_id,uid)!;a.simulator.revoke(uid,connection.id);
    const disconnected=a.finance.forecast(uid,90);assert.ok(!JSON.stringify(disconnected).includes(payload.scheduled_item_id));
    await assert.rejects(a.runs.bridge.legacy(ctx));
  }finally{await a.finish();}
});

test('FP-15/16: chat is session-owned, grounded, bounded, excludes secrets and starts runs only on explicit request',async()=>{
  let calls=0;const a=await setup({infer:model(messages=>{
    calls++;const context=JSON.stringify(messages);
    for(const secret of ['test-provider-secret',...a.sessions.flatMap(s=>[s.session,s.csrf]),...a.credentials.flatMap((c:{app_password:string})=>[c.app_password])])assert.ok(!context.includes(secret));
  })});
  try{
    a.link();const run=await a.request('runs','POST',checkup());await a.runs.drain();
    const response=await a.request('chat','POST',{message:'Explain the current findings.'});assert.equal(response.status,200);assert.equal(response.data.requested_run_id,null);assert.ok(response.data.evidence_ids.length);
    const conversation=response.data.conversation_id;const before=calls;
    assert.equal((await a.request('chat','POST',{message:'Explain.',conversation_id:conversation},1)).status,404);assert.equal(calls,before);
    assert.equal((await a.request('chat','POST',{message:'my password is private'})).status,400);assert.equal(calls,before);
    assert.equal((await a.request('chat','POST',{message:'123456'})).status,400);
    assert.equal((await a.request('chat','POST',{message:'A'.repeat(2001)})).status,400);
    assert.equal(a.store.one("SELECT COUNT(*) AS n FROM chat_messages WHERE role='user'")!.n,0);
    const requested=await a.request('chat','POST',{message:'Run a financial checkup',conversation_id:conversation});assert.equal(requested.status,200);assert.ok(requested.data.requested_run_id);await a.runs.drain();
    assert.equal(a.runs.view('demo-01',requested.data.requested_run_id).status,'completed');
    assert.equal(a.runs.view('demo-01',run.data.run_id).status,'completed');
    a.runs.options.infer=async()=>{throw Error('provider response with secret');};
    const failed=await a.request('chat','POST',{message:'Explain.',conversation_id:conversation});assert.equal(failed.status,502);assert.ok(!JSON.stringify(failed).includes('provider response with secret'));
  }finally{await a.finish();}
});

test('FP-16: stale queued work and server restart fail visibly without replaying provider calls or financial events',async()=>{
  const a=await setup();let restarted:Runs|undefined;
  try{
    a.link();const run=await a.request('runs','POST',checkup());a.store.invalidate('demo-01');await a.runs.drain();
    assert.equal(a.runs.view('demo-01',run.data.run_id).error_code,'stale_snapshot');assert.equal(a.runs.view('demo-01',run.data.run_id).model_calls,0);
    const id=token();a.store.exec("INSERT INTO runs VALUES(?,?,?,'running',?,?,?,NULL)",id,'demo-01','cash',a.store.user('demo-01').snapshot_version,'interrupted',iso());
    restarted=new Runs(a.store,a.auth,a.finance,a.planning,{config,infer:async()=>{throw Error('must not replay');}});
    assert.equal(a.store.one('SELECT status FROM runs WHERE id=? AND user_id=?',id,'demo-01')!.status,'failed');
    assert.equal(a.store.one('SELECT error_code FROM runs WHERE id=? AND user_id=?',id,'demo-01')!.error_code,'interrupted');
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM demo_events')!.n,0);
  }finally{await restarted?.close();await a.finish();}
});

test('FP-16: HTTP password/OTP, link, run, polling and logout flow uses opaque hashed sessions and safe cookies',async()=>{
  let code='';const a=await setup();
  try{
    a.auth.delivery.send=async(_email,value)=>{code=value;};
    const login=await a.request('auth/login','POST',{email:a.credentials[0].email,password:a.credentials[0].app_password},0,{cookie:''});
    assert.equal(login.status,202);
    const pending=login.headers.getSetCookie().find(s=>s.startsWith('fp_pending='))!.match(/^fp_pending=([^;]+)/)![1];
    assert.equal((await a.request('overview','GET',undefined,0,{cookie:'fp_pending='+pending})).status,401);
    const verify=await a.request('auth/verify','POST',{challenge_id:login.data.challenge_id,code},0,{cookie:'fp_pending='+pending});assert.equal(verify.status,200);
    const cookies=verify.headers.getSetCookie();const sessionCookie=cookies.find(s=>s.startsWith('fp_session='))!;
    assert.ok(sessionCookie.includes('HttpOnly'));assert.ok(sessionCookie.includes('SameSite=Lax'));
    const session=sessionCookie.match(/^fp_session=([^;]+)/)![1],csrf=cookies.find(s=>s.startsWith('fp_csrf='))!.match(/^fp_csrf=([^;]+)/)![1];
    const headers={cookie:`fp_session=${session}; fp_csrf=${csrf}`,'x-csrf-token':csrf};
    const authRow=a.auth.session(session);assert.notEqual(authRow.token_hash,session);assert.equal(authRow.token_hash.length,64);
    assert.ok(!JSON.stringify(a.store.all('SELECT * FROM login_challenges')).includes('"'+code+'"'));
    const c=a.credentials[0].institutions[0];
    const preview=await a.request('connections/preview','POST',{institution_id:c.institution_id,demo_username:c.username,demo_password:c.password},0,headers);assert.equal(preview.status,200);
    const linked=await a.request('connections','POST',{preview_token:preview.data.preview_token,account_ids:preview.data.accounts.map((x:{id:string})=>x.id),consent_version:'v1',idempotency_key:'http-link'},0,headers);assert.equal(linked.status,201);
    const run=await a.request('runs','POST',checkup('http-flow'),0,headers);assert.equal(run.status,202);await a.runs.drain();
    assert.equal((await a.request('runs/'+run.data.run_id,'GET',undefined,0,headers)).data.status,'completed');
    assert.equal((await a.request('auth/logout','POST',undefined,0,headers)).status,204);
    assert.equal((await a.request('runs/'+run.data.run_id,'GET',undefined,0,headers)).status,401);
  }finally{await a.finish();}
});

test('FP-16: event transaction rolls back on storage failure; provider failure preserves accepted plan and event replay',async()=>{
  let calls=0;const a=await setup({infer:async()=>{calls++;throw Error('private provider payload');}});
  try{
    a.link();const baseline=acceptBaseline(a),original=a.finance.overview('demo-01');
    const accepted=a.planning.plan('demo-01',baseline.id).payload_json;
    a.store.db.exec("CREATE TRIGGER fail_event_storage BEFORE INSERT ON run_state WHEN json_extract(NEW.request_json,'$.event_id') IS NOT NULL BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    const input={kind:'surprise_expense',amount_cents:4321,idempotency_key:'atomic-expense'};
    const failed=await a.request('demo/events','POST',input);assert.equal(failed.status,500);
    assert.equal(a.finance.overview('demo-01').liquid_cash_cents,original.liquid_cash_cents);
    assert.equal(a.store.user('demo-01').snapshot_version,original.snapshot_version);
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM demo_events')!.n,0);
    a.store.db.exec('DROP TRIGGER fail_event_storage');
    const event=await a.request('demo/events','POST',input);assert.equal(event.status,202);await a.runs.drain();
    assert.equal(a.runs.view('demo-01',event.data.run_id).status,'failed');assert.equal(calls,1);
    assert.equal(a.planning.plan('demo-01',baseline.id).payload_json,accepted);assert.equal(a.planning.plan('demo-01',baseline.id).status,'accepted');
    assert.equal(a.store.one("SELECT COUNT(*) AS n FROM plans WHERE status='proposed'")!.n,0);
    assert.equal((await a.request('demo/events','POST',input)).data.event_id,event.data.event_id);assert.equal(calls,1);
    assert.equal(a.finance.overview('demo-01').liquid_cash_cents,original.liquid_cash_cents-4321);
  }finally{await a.finish();}
});
