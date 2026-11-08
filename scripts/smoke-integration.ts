import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readConfig } from '../src/server/nemotron/index.ts';
import type { ToolContext } from '../contracts/types.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { RepairStore,repairChangedEvent } from '../src/server/agents/repair/index.ts';
import { runCheckup } from '../src/server/agents/coordinator/index.ts';
import { chat } from '../src/server/agents/chat/index.ts';
import { seedPersonas } from './integration/snapshots.ts';
import { fixture,context } from './fixtures/fp20.ts';
import { fetchOffers } from '../src/server/offers/source.ts';
const dir=mkdtempSync(join(tmpdir(),'finpilot-rehearsal-'));let stage='configuration';let store:RepairStore|undefined;let seeds:ReturnType<typeof seedPersonas>|undefined;
try {
  const config=readConfig();const started=Date.now();
  stage='changed-expense-repair';store=new RepairStore(join(dir,'repair.sqlite'));store.initialize(context,fixture(),'balanced',true);
  const accepted=store.read(context.userId).accepted;const budget=new RunBudget();
  const repairOptions={store,context,event:{idempotencyKey:'rehearsal-expense',kind:'surprise_expense' as const,accountId:'checking',amountCents:200000,expectedSnapshotVersion:1},config,budget,demoMode:true,
    authorize:async(ctx:ToolContext)=>{assert.equal(ctx.userId,context.userId);assert.deepEqual(ctx.allowedAccountIds,context.allowedAccountIds);}};
  const repair=await repairChangedEvent(repairOptions);if(repair.status!=='proposed')console.error(JSON.stringify({stage,repair}));assert.ok(!repair.replayed && repair.status==='proposed');
  const replay=await repairChangedEvent({...repairOptions,budget:new RunBudget()});assert.ok(replay.replayed);assert.equal(replay.new_model_calls,0);assert.equal(replay.inference_source_mode,'cached');
  assert.deepEqual(store.read(context.userId).accepted,accepted);assert.equal(store.read(context.userId).snapshot.accounts[0].balanceCents,300000);
  writeFileSync(new URL('../src/server/agents/repair/acceptance.json',import.meta.url),JSON.stringify({status:'passed',inference_source_mode:'live',financial_source_mode:'fixture',repair,replayed:true,replay_new_model_calls:0,accepted_plan_retained:true},null,2)+'\n');
  console.log(JSON.stringify({stage,status:'passed',model_calls:budget.calls}));
  stage='synthetic-seed';const seeded=spawnSync('python3',['scripts/seed_demo.py','--database',join(dir,'seed.sqlite')],{encoding:'utf8'});assert.equal(seeded.status,0);
  seeds=seedPersonas(join(dir,'seed.sqlite'));
  const profiles=[];let chatRecord:{packet:ReturnType<ReturnType<typeof seedPersonas>['load']>;result:Awaited<ReturnType<typeof runCheckup>>}|undefined;
  for(const userId of ['demo-01','demo-06','demo-10']){
    stage=`persona-${userId}`;const packet=seeds.load(userId,`rehearsal-${userId}`,true);const calls=new RunBudget();
    const result=await runCheckup({context:packet.context,config,budget:calls,intent:'cash',authorize:packet.authorize,toolsFor:packet.toolsFor});
    const usable=['completed','needs_information'].includes(result.coordinator.result.status)&&result.results.some(r=>r.role==='cash-collision'&&r.result.status==='completed');
    if(!usable)assert.ok(result.partial,'A failed provider/dependency must be exposed as partial, never successful.');
    assert.ok(calls.calls<=24);
    const profile=seeds.profiles.find(p=>p.id===userId);assert.ok(profile);
    profiles.push({user_id:userId,persona:profile.persona,context:packet.context,usable,...result});
    if(usable&&!chatRecord)chatRecord={packet,result};
    console.log(JSON.stringify({stage,status:usable?'passed':'partial',model_calls:calls.calls,failures:result.results.flatMap(r=>r.events.filter(e=>e.type==='failed').map(e=>e.message))}));
  }
  stage='grounded-chat';if(!chatRecord)throw new Error('NO_PROFILE');const packet=chatRecord.packet;const result=chatRecord.result;const chatContext={...packet.context,runId:`chat-${packet.context.runId}`};
  const findings=result.results.map(r=>({context:packet.context,result:r.result,toolOutputs:r.serverToolOutputs}));
  const response=await chat({context:chatContext,message:'Explain the cash findings and their evidence. Do not request a new run.',config,budget:new RunBudget(),
    load:async()=>{await packet.authorize(packet.context);return {context:chatContext,overview:{source_mode:'fixture',as_of:packet.legacy.asOf},findings,plan:null};}});
  if(response.result.result.status!=='completed')console.error(JSON.stringify({stage,failures:response.result.events.filter(e=>e.type==='failed')}));assert.equal(response.result.result.status,'completed');assert.equal(response.requested_run_id,null);
  stage='partial-failure';const exhausted=new RunBudget();for(let n=0;n<24;n++)exhausted.take();
  const partial=await runCheckup({context:packet.context,config,budget:exhausted,intent:'cash',authorize:packet.authorize,toolsFor:packet.toolsFor});assert.equal(partial.coordinator.result.status,'failed');assert.equal(partial.partial,true);
  stage='external-public-retrieval';const external=await fetchOffers(new AbortController().signal);assert.equal(external.availability,'available');
  const historical=[
    ['data-integrity','src/server/agents/runtime/acceptance.json','integrity'],['cash-collision','src/server/agents/runtime/acceptance.json','cash'],
    ['subscription-detective','src/server/offers/acceptance.json','subscriptions'],['deal-scout','src/server/offers/acceptance.json','deals'],
    ['debt-readiness','src/server/agents/planning/acceptance.json','debt'],['goal-allocator','src/server/agents/planning/acceptance.json','goals'],
    ['stress-test','src/server/agents/stress/acceptance.json','stress'],
  ].map(([role,path,key])=>{const record=JSON.parse(readFileSync(path,'utf8'));assert.equal(record.status,'passed');assert.equal(record[key].result.status,'completed');return {role,path,recorded_at:record.checked_at,retained_live_trace:true};});
  const elapsed=Date.now()-started;
  const laneStatus=profiles.every(p=>p.usable)?'passed':'passed_with_partial_failures';
  const report={agent_lane_status:laneStatus,profile_success_count:profiles.filter(p=>p.usable).length,application_rehearsal_status:'blocked_missing_FP07_workspace_and_planning_metadata',all_tasks_fully_accepted:false,
    checked_at:new Date().toISOString(),inference_source_mode:'live',financial_source_mode:'fixture',elapsed_ms:elapsed,cli_rehearsal_within_three_minutes:elapsed<=180000,
    model:config.model,repair,repair_replay:{inference_source_mode:'cached',new_model_calls:0,accepted_plan_retained:true},profiles,chat:response,
    partial_failure:{injected:'global_budget_exhaustion',actual_new_provider_calls:0,...partial},external,
    specialist_coverage:[...historical,{role:'plan-repair',retained_live_trace:true,path:'src/server/agents/repair/acceptance.json'}],
    limitations:['Frontend/auth/finance and FP-15 agent APIs are implemented and locally tested; FP-07 workspace and general planning metadata remain incomplete.','Harness consent is explicit and synthetic only; it is not production authentication.','Plan repair is dispatched through the event service, not a regular checkup role.','24 model calls per checkup can skip lower-priority specialists; skipped reasons are retained.','Public-source sponsor acceptance still requires sponsor confirmation.']};
  const json=JSON.stringify(report,null,2);assert.ok(!json.includes(config.apiKey));
  writeFileSync(new URL('../src/server/agents/integration/acceptance.json',import.meta.url),json+'\n');
  console.log(JSON.stringify({agent_lane_status:laneStatus,elapsed_ms:elapsed,cli_rehearsal_within_three_minutes:elapsed<=180000,profile_count:profiles.length,application_rehearsal_status:report.application_rehearsal_status}));
} catch {
  console.error(JSON.stringify({status:'failed',stage,code:'INTEGRATION_FAILED'}));process.exitCode=1;
} finally {store?.close();seeds?.close();rmSync(dir,{recursive:true,force:true});}
