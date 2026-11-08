import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture,context } from '../scripts/fixtures/fp20.ts';
import { RepairStore,repairChangedEvent } from '../src/server/agents/repair/index.ts';
import { EvidenceGate,scopedTool } from '../src/server/agents/evidence/index.ts';
import { runCheckup,orderedRoles,mergeFindings } from '../src/server/agents/coordinator/index.ts';
import { chat } from '../src/server/agents/chat/index.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { createTools } from '../src/server/agents/runtime/tools.ts';
import type { complete } from '../src/server/nemotron/index.ts';
import type { AgentResult,ToolContext,SpecialistId } from '../contracts/types.ts';
const config={apiKey:'test-secret',baseUrl:'https://example.test',model:'nvidia/nemotron',timeoutMs:30000};
const signal=()=>new AbortController().signal;const event={idempotencyKey:'expense-one',kind:'surprise_expense' as const,accountId:'checking',amountCents:200000,expectedSnapshotVersion:1};
function model(selected=['cash-collision']):typeof complete {
  return async(_config,messages,available)=>{
    if(available?.length){const name=available[0].function.name;return {latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:name,type:'function',function:{name,arguments:JSON.stringify({scope:'snapshot',...(name==='route_specialists'?{specialists:selected}:{})})}}]}};}
    const role=messages[0].content!.match(/Your agent_id is ([^;]+);/)![1];const version=Number(messages[0].content!.match(/snapshot_version is (\d+)/)![1]);
    const ids=[...new Set(messages.filter(m=>m.role==='tool').flatMap(m=>JSON.parse(m.content!).evidence.map((e:{id:string})=>e.id)))];
    return {latencyMs:1,message:{role:'assistant',content:JSON.stringify({agent_id:role,status:'completed',headline:'Validated analysis.',findings:[],evidence_ids:ids,assumptions:[],missing_data:[],proposed_actions:[],snapshot_version:version,...(role==='coordinator'?{selected_specialists:selected}:{})})}};
  };
}
const authorize=async(ctx:ToolContext)=>{assert.equal(ctx.userId,context.userId);assert.deepEqual(ctx.allowedAccountIds,context.allowedAccountIds);};
function options(store:RepairStore){return {store,context,event,config,budget:new RunBudget(),authorize,demoMode:true,infer:model()};}
test('durable expense idempotency runs actual tools once and preserves accepted version',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fp22-test-'));const path=join(dir,'repair.sqlite');let store=new RepairStore(path);
  try{
    store.initialize(context,fixture(),'balanced',true);const accepted=store.read(context.userId).accepted;
    const first=await repairChangedEvent(options(store));assert.ok(!first.replayed && first.status==='proposed');assert.equal(first.model_calls,13);
    assert.equal(first.repair.trace.length,4);assert.equal(first.revision.requires_confirmation,true);
    assert.equal(first.revision.before?.extra_debt_cents,109250);assert.equal(first.revision.after?.extra_debt_cents,9250);
    assert.deepEqual(store.read(context.userId).accepted,accepted);assert.equal(store.read(context.userId).snapshot.accounts[0].balanceCents,300000);
    store.close();store=new RepairStore(path);const replay=await repairChangedEvent(options(store));
    assert.ok(replay.replayed);assert.equal(replay.new_model_calls,0);assert.equal(replay.inference_source_mode,'cached');
    assert.equal(store.read(context.userId).snapshot.accounts[0].balanceCents,300000);
    await assert.rejects(repairChangedEvent({...options(store),event:{...event,amountCents:1}}));
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('provider failure retains accepted plan; duplicate running event never starts another inference',async()=>{
  const store=new RepairStore(':memory:');store.initialize(context,fixture(),'balanced',true);const accepted=store.read(context.userId).accepted;
  let release!:()=>void;let entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve);let first=true;
  const blocked:typeof complete=async()=>{if(first){first=false;entered();await new Promise<void>(r=>release=r);}throw new Error('secret');};
  const active=repairChangedEvent({...options(store),infer:blocked});await started;
  const duplicate=await repairChangedEvent(options(store));assert.equal(duplicate.status,'processing');assert.ok(duplicate.replayed);
  release();const failed=await active;assert.equal(failed.status,'failed');assert.deepEqual(store.read(context.userId).accepted,accepted);
  assert.ok(!JSON.stringify(failed).includes('secret'));store.close();
});
test('event ownership, consent, version, demo mode and explicit acceptance are enforced',async()=>{
  const store=new RepairStore(':memory:');assert.throws(()=>store.initialize(context,fixture(),'balanced',false));store.initialize(context,fixture(),'balanced',true);
  await assert.rejects(repairChangedEvent({...options(store),demoMode:false}));
  await assert.rejects(repairChangedEvent({...options(store),event:{...event,accountId:'foreign'}}));
  await assert.rejects(repairChangedEvent({...options(store),event:{...event,expectedSnapshotVersion:2}}));
  await assert.rejects(repairChangedEvent({...options(store),authorize:async()=>{throw new Error('revoked');}}));
  assert.equal(store.read(context.userId).snapshot.version,1);store.close();
});
function result(id:string,amount:number|null=50000):AgentResult{return {agent_id:'cash-collision',status:'completed',headline:'Scoped finding.',findings:[{id:'cash',severity:'warning',summary:'Cash is $500.00 on 2026-11-07.',evidence_ids:[id],amount_cents:amount}],evidence_ids:[id],assumptions:[],missing_data:[],proposed_actions:[],snapshot_version:1};}
test('evidence gate rejects unknown/cross-user/numeric/date claims',async()=>{
  const gate=new EvidenceGate();const out=await scopedTool('source',async()=>({amount_cents:50000,date:'2026-11-07'})).execute({scope:'snapshot'},context,signal());
  gate.register(context,out);const id=out.evidence[0].id;assert.equal(gate.check(context,result(id)).status,'completed');
  assert.throws(()=>gate.check(context,result('unknown')));assert.throws(()=>gate.check({...context,userId:'other'},result(id)));
  assert.throws(()=>gate.check(context,result(id,50001)));
  const wrong=result(id);wrong.findings[0].summary='Cash is $50000.00 on 2026-11-08.';assert.throws(()=>gate.check(context,wrong));
  const stale=result(id);stale.snapshot_version=2;assert.throws(()=>gate.check(context,stale));
});
function legacy(){const s=fixture();return {userId:s.userId,version:s.version,asOf:s.asOf,sourceMode:s.sourceMode,accounts:s.accounts.map(a=>({id:a.id,userId:a.userId,connected:a.connected,kind:a.kind,openingCents:a.balanceCents,balanceCents:a.balanceCents,syncedAt:'2026-11-07T00:00:00Z'})),transactions:[],scheduled:[]};}
test('coordinator visibly hands off dependencies, skips irrelevant roles and respects global budget',async()=>{
  const budget=new RunBudget();const r=await runCheckup({context,config,budget,intent:'cash',authorize,toolsFor:r=>['data-integrity','cash-collision'].includes(r)?createTools(async()=>legacy()):null,infer:model()});
  assert.equal(r.coordinator.result.status,'completed');assert.equal(r.model_calls,12);
  assert.deepEqual(r.steps.filter(s=>s.status==='completed').map(s=>s.role),['data-integrity','cash-collision']);
  assert.ok(r.steps.some(s=>s.role==='deal-scout'&&s.status==='skipped'&&s.reason.includes('Irrelevant')));
  assert.deepEqual(orderedRoles(['goal-allocator']),['data-integrity','cash-collision','debt-readiness','goal-allocator']);
  const exhausted=new RunBudget();for(let n=0;n<22;n++)exhausted.take();
  const partial=await runCheckup({context,config,budget:exhausted,intent:'cash',authorize,toolsFor:()=>createTools(async()=>legacy()),infer:model()});
  assert.ok(partial.partial);assert.ok(exhausted.calls<=24);
});
test('merge retains mutually exclusive options and exposes conflicting canonical claims',()=>{
  const r=result('one');const m=mergeFindings([{role:'one',result:r,claims:[{key:'current-cash',amount_cents:1}]},{role:'two',result:r,claims:[{key:'current-cash',amount_cents:2}]}]);
  assert.deepEqual(m.conflicts,['current-cash']);assert.equal(m.findings.length,2);assert.notEqual(m.findings[0].id,m.findings[1].id);assert.ok(m.allocation_policy.includes('mutually exclusive'));
});
test('chat validates each stored finding owner; read-only questions never request runs',async()=>{
  const source=await scopedTool('source',async()=>({amount_cents:50000,date:'2026-11-07'})).execute({scope:'snapshot'},context,signal());
  const record={context,result:result(source.evidence[0].id),toolOutputs:[source]};
  const load=async()=>({context,overview:{cash_cents:50000},findings:[record],plan:{context,payload:{available_cents:50000}}});
  let requests=0;const read=await chat({context,message:'Explain my findings',config,budget:new RunBudget(),load,infer:model(),requestRun:async()=>{requests++;return 'new-run';}});
  assert.equal(read.result.result.status,'completed');assert.equal(requests,0);assert.equal(read.requested_run_id,null);
  const run=await chat({context,message:'Run a checkup',allowRunRequest:true,config,budget:new RunBudget(),load,infer:model(),requestRun:async(ctx,key)=>{requests++;assert.equal(ctx.userId,context.userId);assert.ok(key.startsWith('chat:'));return 'new-run';}});
  assert.equal(run.requested_run_id,'new-run');assert.equal(requests,1);
  const foreign=await chat({context,message:'Explain',config,budget:new RunBudget(),infer:model(),load:async()=>({...await load(),findings:[{...record,context:{...context,userId:'other'}}]})});
  assert.equal(foreign.result.result.status,'failed');assert.equal(foreign.evidence_ids.length,0);
  await assert.rejects(chat({context,message:'password=secret',config,budget:new RunBudget(),load,infer:model()}));
});

test('coordinator cannot silently resolve conflicting source claims or route irrelevant tools',async()=>{
  const factory=(role:SpecialistId)=>{
    const tools=createTools(async()=>legacy());const name=role==='data-integrity'?'get_connection_status':'forecast_cash';const execute=tools[name].execute;
    tools[name]={...tools[name],async execute(...args){const out=await execute(...args);return {...out,data:{...out.data as object,canonical_claims:[{key:'current_cash',amount_cents:role==='data-integrity'?1:2}]}};}};
    return tools;
  };
  const conflict=await runCheckup({context,config,budget:new RunBudget(),intent:'cash',authorize,toolsFor:factory,infer:model()});
  assert.deepEqual(conflict.merge.conflicts,['current_cash']);assert.equal(conflict.coordinator.result.status,'failed');assert.equal(conflict.partial,true);
  const bad=await runCheckup({context,config,budget:new RunBudget(),intent:'cash',authorize,toolsFor:factory,infer:model(['deal-scout'])});
  assert.equal(bad.results.length,0);assert.equal(bad.coordinator.result.status,'failed');
});
test('chat tool calls do not grant authorization and foreign plan context is rejected',async()=>{
  let requested=0;
  const load=async()=>({context,overview:{cash_cents:50000},findings:[],plan:null});
  const hostile:typeof complete=async()=>({latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:'x',type:'function',function:{name:'request_checkup',arguments:'{"scope":"snapshot"}'}}]}});
  const r=await chat({context,message:'Explain cash',config,budget:new RunBudget(),load,infer:hostile,requestRun:async()=>{requested++;return 'x';}});
  assert.equal(r.result.result.status,'failed');assert.equal(requested,0);
  const foreign=await chat({context,message:'Read plan',config,budget:new RunBudget(),infer:model(),load:async()=>({...await load(),plan:{context:{...context,userId:'other'},payload:{cash_cents:999999}}})});
  assert.equal(foreign.result.result.status,'failed');
  await assert.rejects(chat({context,message:'my password is secret',config,budget:new RunBudget(),load,infer:model()}));
  await assert.rejects(chat({context,message:'123456',config,budget:new RunBudget(),load,infer:model()}));
});
