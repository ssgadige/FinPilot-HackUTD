import { test } from 'node:test';
import assert from 'node:assert/strict';
import { application } from './application';
import { Runs,type Runner } from '../../src/server/runs';
import { NemotronRunner,DatabaseOffers } from '../../src/server/runtime-adapter';
import { Chat } from '../../src/server/chat';
import { token,iso } from '../../src/server/auth';
import { testInference,testConfig } from './runtime-fixture';
async function integrated(options:{infer?:ReturnType<typeof testInference>}={}) {
  const a=await application(),runner=new NemotronRunner(a.store,a.finance,a.planning,{infer:options.infer??testInference(),config:testConfig}),runs=new Runs(a.store,runner,5000,a.planning);
  a.services.runs=runs;a.services.demoMode=true;a.services.chat=new Chat(a.store,{async reply(){return 'A financial checkup is needed for account-specific evidence.';}});
  a.link();return {...a,runs};
}
test('FP-15: authenticated checkup persists tool evidence, dependency steps and safe incremental events',async()=>{
  const a=await integrated();try {
    assert.equal((await a.request('runs','POST',{intent:'checkup',idempotency_key:'bad',user_id:'demo-02'})).status,400);
    const queued=await a.request('runs','POST',{intent:'checkup',idempotency_key:'checkup'});assert.equal(queued.status,202);await a.runs.idle();
    const run=await a.request('runs/'+queued.data.run_id);assert.ok(['completed','needs_information'].includes(run.data.status),JSON.stringify(run.data));
    assert.ok(run.data.steps.some((s:{agent_id:string})=>s.agent_id==='cash-collision'));assert.equal(run.data.financial_source_mode,'fixture');
    const evidence=a.store.all('SELECT * FROM evidence WHERE run_id=? AND user_id=?',queued.data.run_id,'demo-01');assert.ok(evidence.length>0);assert.ok(evidence.every(e=>e.source_mode==='fixture'||e.kind==='offer'));
    const events=await a.request('runs/'+queued.data.run_id+'/events');assert.ok(events.data.items.some((e:{type:string})=>e.type==='tool_completed'));
    assert.equal((await a.request('runs/'+queued.data.run_id+'/events?cursor='+events.data.next_cursor)).data.items.length,0);
    assert.equal((await a.request('runs/'+queued.data.run_id,undefined,undefined,1)).status,404);
    assert.equal((await a.request('runs/'+queued.data.run_id+'/cancel','POST',{},1)).status,404);
    assert.equal((await a.request('runs','POST',{intent:'checkup',idempotency_key:'checkup'})).data.run_id,queued.data.run_id);
  }finally{await a.runs.idle();a.close();}
});
test('FP-15: changed data is applied once and creates a proposal without accepting it',async()=>{
  const a=await integrated();try {
    const id=token();a.store.exec("INSERT INTO runs VALUES(?,?,?,'completed',?,?,?,NULL)",id,'demo-01','test',a.store.user('demo-01').snapshot_version,id,iso());
    const goal=a.store.one('SELECT id FROM goals WHERE user_id=?','demo-01')!;
    const plan=a.planning.propose('demo-01',id,{allocations:[{kind:'goal_contribution',target_id:goal.id,monthly_cents:10000,day_of_month:15}],reserve_cents:10000,evidence_ids:[],assumptions:[]});
    a.planning.accept('demo-01',plan.id,{expected_version:1,confirmation:true,idempotency_key:'accept'});
    const balance=a.finance.overview('demo-01').liquid_cash_cents,snapshot=a.store.user('demo-01').snapshot_version;
    const body={kind:'surprise_expense',amount_cents:12345,idempotency_key:'event'};
    const event=await a.request('demo/events','POST',body),replay=await a.request('demo/events','POST',body);assert.equal(event.status,201);assert.equal(replay.data.id,event.data.id);await a.runs.idle();
    assert.equal(a.finance.overview('demo-01').liquid_cash_cents,balance-12345);assert.equal(a.store.user('demo-01').snapshot_version,snapshot+1);
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM demo_events WHERE user_id=?','demo-01')!.n,1);
    assert.equal(a.planning.plan('demo-01',plan.id).status,'accepted');
    const repair=await a.request('runs/'+event.data.run_id);assert.equal(repair.data.status,'completed',JSON.stringify(repair.data));
    const proposed=a.store.one("SELECT * FROM plans WHERE user_id=? AND status='proposed' AND parent_plan_id=?",'demo-01',plan.id);assert.ok(proposed);assert.equal(proposed.snapshot_version,snapshot+1);
    assert.equal((await a.request('runs/'+id)).data.stale,true);assert.deepEqual((await a.request('runs/'+id+'/events')).data.items,[]);
    assert.equal((await a.request('demo/events','POST',{...body,amount_cents:99})).status,409);
    const accepted=await a.request('plans/'+proposed.id+'/accept','POST',{expected_version:proposed.version,confirmation:true,idempotency_key:'revision'});assert.equal(accepted.status,200);
    assert.equal(a.planning.plan('demo-01',plan.id).status,'superseded');
  }finally{await a.runs.idle();a.close();}
});
test('FP-15: cancellation stops new model/tool calls and an uncooperative provider times out',async()=>{
  const a=await application();let release!:()=>void,calls=0;const gate=new Promise<void>(resolve=>release=resolve);
  const runner:Runner={async run(_intent,_ctx,control){control.beforeCall('model','coordinator');calls++;await gate;control.beforeCall('tool','coordinator');calls++;return [];}};
  const runs=new Runs(a.store,runner,100,a.planning);a.services.runs=runs;
  try {
    const q=await a.request('runs','POST',{intent:'checkup',idempotency_key:'cancel'});await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await a.request('runs/'+q.data.run_id+'/cancel','POST',{})).status,200);release();await runs.idle();assert.equal(calls,1);assert.equal(runs.get('demo-01',q.data.run_id).status,'cancelled');
    const stuck=new Runs(a.store,{async run(){return new Promise(()=>{});}},15,a.planning),r=stuck.enqueue('demo-01','checkup','timeout');await stuck.idle();assert.equal(stuck.get('demo-01',r.id).error_code,'run_timeout');
  }finally{release();await runs.idle();a.close();}
});
test('FP-15: chat remains scoped, rejects identity/secret inputs and persists only bounded history',async()=>{
  const a=await integrated();try {
    assert.equal((await a.request('chat','POST',{message:'hello',user_id:'demo-02'})).status,400);
    assert.equal((await a.request('chat','POST',{message:'password=private'})).status,400);
    const first=await a.request('chat','POST',{message:'Explain a budget'});assert.equal(first.status,200);
    assert.equal((await a.request('chat','POST',{message:'Hello',conversation_id:first.data.conversation_id},1)).status,404);
    for(let i=0;i<11;i++)await a.services.chat!.send('demo-01','Explain budgeting',first.data.conversation_id);
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM chat_messages WHERE conversation_id=? AND user_id=?',first.data.conversation_id,'demo-01')!.n,20);
    const stuck=new Chat(a.store,{async reply(){return new Promise(()=>{});}},10);await assert.rejects(stuck.send('demo-02','Explain budgeting'),{code:'nemotron_failed'});
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM conversations WHERE user_id=?','demo-02')!.n,0);
  }finally{await a.runs.idle();a.close();}
});
test('FP-15: missing provider and offers have honest availability and source labels',async()=>{
  const a=await application();const old={NVIDIA_API_KEY:process.env.NVIDIA_API_KEY,NEMOTRON_MODEL:process.env.NEMOTRON_MODEL};
  delete process.env.NVIDIA_API_KEY;delete process.env.NEMOTRON_MODEL;
  const runs=new Runs(a.store,new NemotronRunner(a.store,a.finance,a.planning),1000,a.planning);a.services.runs=runs;
  try {
    const q=await a.request('runs','POST',{intent:'checkup',idempotency_key:'missing'});assert.equal(q.status,202);await runs.idle();assert.equal(runs.get('demo-01',q.data.run_id).error_code,'NEMOTRON_UNAVAILABLE');
    a.link();const sub=a.store.scoped('subscriptions','demo-01').find(s=>/music|spotify/i.test(s.merchant));
    if(sub){const offers=await new DatabaseOffers(a.store).list('demo-01',sub.id,AbortSignal.timeout(1000));assert.equal(offers.source_mode,'fixture');assert.equal(offers.availability,'fixture_fallback');}
  }finally{for(const [k,v] of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;await runs.idle();a.close();}
});
