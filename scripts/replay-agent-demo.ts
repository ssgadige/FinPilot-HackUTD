import { existsSync, readFileSync } from 'node:fs';
const integrated = new URL('../src/server/agents/integration/acceptance.json',import.meta.url);
// Historical specialist evidence is useful offline, but never implies a
// successful integrated rehearsal or a fresh provider call.
if (!existsSync(integrated)) {
  const sources = [
    ['integrity/cash','../src/server/agents/runtime/acceptance.json'],
    ['subscriptions/deals','../src/server/offers/acceptance.json'],
    ['debt/goals','../src/server/agents/planning/acceptance.json'],
    ['stress','../src/server/agents/stress/acceptance.json'],
    ['repair','../src/server/agents/repair/acceptance.json'],
  ];
  const traces = sources.flatMap(([roles,path]) => {
    const file = new URL(path,import.meta.url);
    if (!existsSync(file)) return [];
    const record = JSON.parse(readFileSync(file,'utf8'));
    if (record.status !== 'passed') return [];
    return [{roles,path,recorded_at:record.checked_at??null,original_status:record.status}];
  });
  console.log(JSON.stringify({mode:'REPLAY',inference_source_mode:'cached',new_provider_calls:0,
    financial_source_mode:'fixture',coverage:'historical_specialist_traces_only',
    application_rehearsal_status:'not_verified',integrated_rehearsal_status:'not_verified',traces},null,2));
  if (!traces.length) process.exitCode=1;
} else {
try {
  const record=JSON.parse(readFileSync(integrated,'utf8'));
  if(!['passed','passed_with_partial_failures'].includes(record.agent_lane_status))throw new Error();
  console.log(JSON.stringify({mode:'REPLAY',inference_source_mode:'cached',new_provider_calls:0,financial_source_mode:'fixture',recorded_at:record.checked_at,
    original_elapsed_ms:record.elapsed_ms,profile_summaries:record.profiles.map((p:{user_id:string;coordinator:{result:{headline:string}};steps:unknown})=>({user_id:p.user_id,headline:p.coordinator.result.headline,steps:p.steps})),
    repair_summary:record.repair.repair.result.headline,limitations:record.limitations},null,2));
} catch {console.error(JSON.stringify({mode:'REPLAY',status:'unavailable',code:'REPLAY_RECORD_MISSING'}));process.exitCode=1;}
}
