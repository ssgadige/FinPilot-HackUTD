import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,context } from '../scripts/fixtures/fp21.ts';
import { validateStress,stressPlans,forecastCandidate } from '../src/server/agents/stress/calculations.ts';
import { makePlans } from '../src/server/agents/planning/calculations.ts';
import { createStressTools,comparison } from '../src/server/agents/stress/tools.ts';
import { unsupportedProbabilityClaim } from '../src/server/agents/stress/policy.ts';
import { runDebt } from '../src/server/agents/debt.ts';
import { runGoals } from '../src/server/agents/goals.ts';
import { runStress } from '../src/server/agents/stress.ts';
import { createPlanningTools } from '../src/server/agents/planning/tools.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import type { complete } from '../src/server/nemotron/index.ts';
const signal=()=>new AbortController().signal;
const args={scope:'snapshot'};
const config={apiKey:'secret-test-key',model:'nvidia/nemotron',baseUrl:'https://example.test',timeoutMs:30000};

test('baseline, source and candidate allocations remain identical across independent shocks',()=>{
  const s=fixture();validateStress(s,context);const before=structuredClone(s);const plans=makePlans(s.planning);const saved=structuredClone(plans);
  const report=stressPlans(s);const again=stressPlans(s);
  assert.deepEqual(s,before);assert.deepEqual(plans,saved);assert.deepEqual(report,again);
  assert.equal(report.plans.length,3);assert.equal(report.fixed_scenarios.length,3);
  for(const p of report.plans){assert.equal(p.baseline.outcome,'no_failure_within_horizon');assert.equal(p.scenarios.length,3);}
  assert.equal(report.plans[0].baseline.minimum_total_cash_cents,250000);
  assert.deepEqual(forecastCandidate(s,plans.alternatives[0],'baseline'),report.plans[0].baseline);
});
test('exact surprise cash-shortfall and distinct buffer/goal breach dates are calculated',()=>{
  const report=stressPlans(fixture());
  const debt=report.plans.find(p=>p.plan_id==='debt_first')!.scenarios.find(s=>s.scenario==='surprise_expense')!;
  assert.equal(debt.first_cash_shortfall_date,'2026-11-20');assert.equal(debt.minimum_total_cash_cents,-50000);
  assert.equal(debt.first_buffer_breach_date,'2026-11-20');
  const goals=report.plans.find(p=>p.plan_id==='goal_first')!.scenarios.find(s=>s.scenario==='surprise_expense')!;
  assert.equal(goals.first_failure_date,'2026-11-14');assert.equal(goals.first_cash_shortfall_date,null);
  assert.equal(goals.first_buffer_breach_date,'2026-11-14');assert.equal(goals.minimum_total_cash_cents,168500);
  assert.equal(goals.goals[0].additional_funding_required_cents,200000);
  assert.equal(goals.goals[0].stressed_remaining_cents,231500);assert.equal(goals.goals[0].estimated_deadline_shift_days,null);
});
test('delayed and reduced income outcomes mean no failure only within tested horizon',()=>{
  const report=stressPlans(fixture());const rows=comparison(report);
  for(const p of report.plans)for(const s of p.scenarios.filter(s=>s.scenario!=='surprise_expense')){
    assert.equal(s.first_failure_date,null);assert.equal(s.outcome,'no_failure_within_horizon');assert.equal(s.horizon_end,'2026-12-07');
    assert.equal(s.probability,null);assert.equal(s.guaranteed_resilience,false);
  }
  assert.equal(rows.scenario_summaries[0].worst_minimum_cash_cents,250000);
  assert.equal(rows.scenario_summaries[2].worst_minimum_cash_cents,225000);
});
test('delayed receipts beyond horizon are not counted; reductions round down to integer cents',()=>{
  const s=fixture();s.incomes[0].date='2026-12-06';s.incomes[0].amountCents=100001;
  validateStress(s,context);const p=makePlans(s.planning).alternatives[0];
  const delayed=forecastCandidate(s,p,'delayed_income');assert.equal(delayed.income_counted_cents,0);assert.equal(delayed.income_delayed_beyond_horizon_cents,100001);
  assert.equal(forecastCandidate(s,p,'reduced_income').income_counted_cents,75000);
  s.incomes[0].confirmed=false;assert.equal(forecastCandidate(s,p,'baseline').income_counted_cents,0);
});
test('no income stays explicit, with no fabricated receipt or probability',()=>{
  const s=fixture();s.incomes=[];const report=stressPlans(s);
  for(const p of report.plans){
    for(const shock of p.scenarios.filter(s=>s.scenario!=='surprise_expense'))assert.equal(shock.closing_total_cash_cents,p.baseline.closing_total_cash_cents);
  }
});
test('same-day expense precedes receipt even if closing balance recovers',()=>{
  const s=fixture();s.incomes[0].date='2026-11-20';s.incomes[0].amountCents=500000;
  const p=makePlans(s.planning).alternatives[0];const r=forecastCandidate(s,p,'surprise_expense');
  assert.equal(r.first_cash_shortfall_date,'2026-11-20');assert.equal(r.minimum_total_cash_cents,-150000);assert.equal(r.closing_total_cash_cents,350000);
});
test('deadline failure can occur before horizon end without inventing a new deadline',()=>{
  const s=fixture();s.planning.goals[0].deadline='2026-11-10';const report=stressPlans(s);
  const base=report.plans.find(p=>p.plan_id==='debt_first')!.baseline;
  assert.equal(base.first_failure_date,'2026-11-10');assert.equal(base.first_cash_shortfall_date,null);
  assert.equal(base.goals[0].deadline_missed_within_horizon,true);assert.equal(base.goals[0].deadline_missed_date,'2026-11-10');
});
test('separate-account cash is not silently transferred to rescue the failing account',()=>{
  const s=fixture();s.planning.accounts.push({id:'savings',userId:context.userId,connected:true,kind:'savings',balanceCents:900000,bufferCents:0});
  validateStress(s,{...context,allowedAccountIds:[...context.allowedAccountIds,'savings']});
  const r=stressPlans(s).plans[0].scenarios.find(s=>s.scenario==='surprise_expense')!;
  assert.ok(r.minimum_total_cash_cents>0);assert.equal(r.first_cash_shortfall_date,'2026-11-20');
});
test('foreign income rows, selected-account violations, bad dates and duplicated receipt IDs fail',()=>{
  for(const mutate of [
    (s:any)=>s.incomes[0].userId='other',(s:any)=>s.incomes[0].accountId='foreign',
    (s:any)=>s.incomes[0].accountId='cd',(s:any)=>s.incomes[0].date='2026-11-07',
    (s:any)=>s.incomes[0].date='2026-02-30',(s:any)=>s.incomes[0].amountCents=0.5,
    (s:any)=>s.incomes.push(s.incomes[0]),(s:any)=>s.planning.accounts[0].connected=false,
    (s:any)=>s.planning.version++,
  ]){const s=fixture();mutate(s);assert.throws(()=>validateStress(s,context));}
});
function model(status='completed',headline='Deterministic stress outcomes'):typeof complete {
  return async(_config,messages,available)=>{
    if(available?.length)return {latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:available[0].function.name,type:'function',function:{name:available[0].function.name,arguments:JSON.stringify(args)}}]}};
    const role=messages[0].content!.includes('Your agent_id is stress-test;')?'stress-test':messages[0].content!.includes('Your agent_id is goal-allocator;')?'goal-allocator':'debt-readiness';
    const ids=messages.filter(m=>m.role==='tool').flatMap(m=>JSON.parse(m.content!).evidence.map((e:any)=>e.id));
    return {latencyMs:1,message:{role:'assistant',content:JSON.stringify({agent_id:role,status,headline,findings:[],evidence_ids:ids,assumptions:[],missing_data:status==='needs_information'?['No candidates available.']:[],proposed_actions:[],snapshot_version:1})}};
  };
}
async function prior(budget:RunBudget){
  const tools=createPlanningTools(async()=>fixture().planning);
  const debt=await runDebt({context,config,tools,budget,infer:model()});
  return runGoals({context,config,tools,budget,infer:model(),dependency:{context,result:debt.result,evidence:debt.evidence}});
}
test('stress role calls three real tools after same-context goals, preserving provenance',async()=>{
  const budget=new RunBudget();const goals=await prior(budget);
  const tools=createStressTools(async()=>fixture());
  const r=await runStress({context,config,tools,budget,infer:model(),dependency:{context,result:goals.result,evidence:goals.evidence}});
  assert.equal(r.result.status,'completed');assert.equal(r.trace.length,3);assert.equal(budget.calls,12);
  assert.ok(r.evidence.every(e=>e.source_mode==='fixture'));
  const data=(await tools.compare_plans.execute(args,context,signal())).data as any;
  assert.equal(data.scenario_summaries[1].currency_display.worst_minimum_cash_cents,'-$500.00');
  assert.ok(JSON.stringify((await tools.stress_test_plan.execute(args,context,signal())).data).length<64000);
});
test('probability claims and guarantees rejected while shock-size percentages remain valid',async()=>{
  const budget=new RunBudget();const goals=await prior(budget);const dependency={context,result:goals.result,evidence:goals.evidence};
  for(const headline of ['There is an 80% chance of failure.','Failure probability is 0.7.','The plan is guaranteed safe.','Failure probability is 1.','The plan will probably fail.']){
    assert.ok(unsupportedProbabilityClaim(headline));
    const r=await runStress({context,config,tools:createStressTools(async()=>fixture()),budget:new RunBudget(),infer:model('completed',headline),dependency});
    assert.equal(r.result.status,'failed');assert.equal(r.events.at(-1)?.message,'INVALID_AGENT_RESULT_PROBABILITY');
  }
  assert.equal(unsupportedProbabilityClaim('A fixed 25% income reduction has no failure within the tested horizon.'),false);
});
test('strict scenario arguments, frozen owner context, and disconnect are checked before calculation',async()=>{
  let reads=0;const tools=createStressTools(async ctx=>{reads++;assert.ok(Object.isFrozen(ctx));assert.ok(Object.isFrozen(ctx.allowedAccountIds));return fixture();});
  for(const bad of [{...args,user_id:'other'},{...args,expense_cents:1},{...args,plan_id:'foreign'}])await assert.rejects(tools.stress_test_plan.execute(bad,context,signal()));
  assert.equal(reads,0);
  const budget=new RunBudget();const goals=await prior(budget);const dependency={context,result:goals.result,evidence:goals.evidence};
  const s=fixture();const disconnect=createStressTools(async()=>{if(++reads>1)s.planning.accounts[0].connected=false;return s;});
  const r=await runStress({context,config,tools:disconnect,budget,infer:model(),dependency});assert.equal(r.result.status,'failed');assert.equal(reads,2);
});


test('returned scenario metadata cannot mutate future runs; no candidates forces uncertainty',async()=>{
  const s=fixture();const report=stressPlans(s);(report.fixed_scenarios[0] as any).delay_days=99;
  assert.equal(stressPlans(s).fixed_scenarios[0].delay_days,7);
  s.planning.accounts[0].balanceCents=1;
  const out=await createStressTools(async()=>s).stress_test_plan.execute(args,context,signal());
  assert.equal(out.needsInformation,true);assert.equal((out.data as any).plans.length,0);assert.ok((out.data as any).missing_data.length>0);
});
test('multiple goals cannot claim the same post-shock cash after the buffer',()=>{
  const s=fixture();s.planning.goals.push({id:'second',userId:context.userId,accountId:'checking',title:'Second goal',targetCents:100000,savedCents:10000,deadline:'2027-01-01',priority:2});
  const report=stressPlans(s);
  for(const p of report.plans)for(const f of [p.baseline,...p.scenarios]){
    const row=f.accounts.find(a=>a.account_id==='checking')!;
    const covered=f.goals.reduce((total,g)=>total+s.planning.goals.find(x=>x.id===g.goal_id)!.savedCents-g.existing_earmarks_at_risk_cents+g.funded_contribution_cents,0);
    assert.ok(covered<=Math.max(0,row.closing_balance_cents-100000));
  }
  const goalFirst=report.plans.find(p=>p.plan_id==='goal_first')!.scenarios.find(s=>s.scenario==='surprise_expense')!;
  assert.equal(goalFirst.goals.find(g=>g.goal_id==='car-goal')!.funded_contribution_cents,8500);
  assert.equal(goalFirst.goals.find(g=>g.goal_id==='second')!.existing_earmarks_at_risk_cents,0);
});
