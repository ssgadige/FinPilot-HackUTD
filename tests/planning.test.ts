import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,context } from '../scripts/fixtures/fp20.ts';
import { validateSnapshot,reserveBudget,makePlans,utilization,missingDebtData } from '../src/server/agents/planning/calculations.ts';
import { simulatePayoff,plusMonths } from '../src/server/agents/planning/math.ts';
import { unsupportedLendingClaim } from '../src/server/agents/planning/policy.ts';
import { createPlanningTools } from '../src/server/agents/planning/tools.ts';
import { runDebt } from '../src/server/agents/debt.ts';
import { runGoals } from '../src/server/agents/goals.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import type { complete } from '../src/server/nemotron/index.ts';
const signal=()=>new AbortController().signal;
const args={scope:'snapshot'};
const config={apiKey:'secret-test-key',model:'nvidia/nemotron',baseUrl:'https://example.test',timeoutMs:30000};

test('reserves bills, minimum once, buffer and saved goals; accepted cost change replaces one bill',()=>{
  const s=fixture();validateSnapshot(s,context);const b=reserveBudget(s);
  assert.equal(b.liquid_cash_cents,500000);assert.equal(b.bills_reserved_cents,121500);
  assert.equal(b.minimum_payments_reserved_cents,10000);assert.equal(b.buffer_reserved_cents,100000);
  assert.equal(b.existing_goal_savings_reserved_cents,50000);assert.equal(b.available_cents,218500);
  assert.equal(b.confirmed_future_cost_reduction_cents,500);assert.equal(b.realized_savings_cents,0);assert.equal(b.future_income_counted_cents,0);
  assert.deepEqual(b.ignored_unconfirmed_change_ids,['unconfirmed-rent']);
  s.costChanges=[];assert.equal(reserveBudget(s).available_cents,218000);
  s.costChanges=fixture().costChanges;s.costChanges[0].effectiveDate='2026-12-01';assert.equal(reserveBudget(s).available_cents,218000);
});
test('three distinct alternatives conserve every cent globally and per account',()=>{
  const s=fixture();const p=makePlans(s);
  assert.deepEqual(p.alternatives.map(a=>[a.id,a.extra_debt_cents,a.new_goal_contribution_cents]),[
    ['debt_first',218500,0],['goal_first',0,218500],['balanced',109250,109250],
  ]);
  for(const a of p.alternatives){
    assert.equal(a.total_accounted_cents,500000);
    assert.equal(a.extra_debt_cents+a.new_goal_contribution_cents+a.unallocated_cents,p.budget.available_cents);
    for(const cash of a.account_allocations)assert.equal(cash.extra_debt_cents+cash.new_goal_contribution_cents+cash.unallocated_cents,cash.available_cents);
    assert.ok(a.requires_confirmation);assert.ok(a.proposal_only);
  }
  assert.ok(p.alternatives[0].estimated_total_interest_cents!<p.alternatives[1].estimated_total_interest_cents!);
  assert.equal(p.alternatives[1].goal_allocations[0].remaining_cents,31500);
  assert.equal(p.alternatives[1].goal_allocations[0].required_future_monthly_cents,2625);
  assert.equal(p.alternatives[1].goal_allocations[0].projected_completion_date,null);
});
test('known amortization examples, zero APR and one-time extra are deterministic',()=>{
  const one=simulatePayoff(120000,2400,122400);assert.equal(one.payoff_months,1);assert.equal(one.total_interest_cents,2400);assert.equal(one.total_paid_cents,122400);
  const zero=simulatePayoff(1200000,0,100000);assert.equal(zero.payoff_months,12);assert.equal(zero.total_interest_cents,0);
  assert.equal(simulatePayoff(1200000,0,100000,300000).payoff_months,9);
  assert.equal(simulatePayoff(100000,2400,1000).status,'non_amortizing');
  assert.equal(simulatePayoff(1200000,0,1,0,2).status,'horizon_exceeded');
  assert.equal(simulatePayoff(0,null,null).payoff_months,0);
  assert.equal(simulatePayoff(100000,null,1000).status,'needs_information');
  assert.equal(simulatePayoff(100000,0,null).status,'needs_information');
  assert.equal(plusMonths('2026-01-31',1),'2026-02-28');
  assert.throws(()=>simulatePayoff(100000,10001,1000));assert.throws(()=>simulatePayoff(100000,2400,1000,0,361));
  assert.throws(()=>simulatePayoff(Number.MAX_SAFE_INTEGER,10000,1));
});
test('partial or larger scheduled debt payments cover minimum once and reduce extra-payment capacity',()=>{
  const s=fixture();s.bills[2].amountCents=4000;
  const b=reserveBudget(s);assert.equal(b.minimum_payments_reserved_cents,10000);assert.equal(b.accounts[0].obligations_reserved_cents,131500);
  s.bills[2].amountCents=20000;validateSnapshot(s,context);
  const p=makePlans(s);const d=p.alternatives[0].debt_allocations[0];
  assert.equal(d.committed_payment_cents,20000);assert.equal(p.budget.available_cents,208500);
  assert.equal(d.first_period_payment_budget_cents,228500);
  assert.equal(d.projection.first_extra_cents,218500);
});
test('cash shortages, missing minimum and unreconciled balances never allocate other accounts funds',()=>{
  const s=fixture();s.accounts[0].balanceCents=100;
  assert.equal(makePlans(s).alternatives.length,0);assert.equal(reserveBudget(s).available_cents,0);
  const unknown=fixture();unknown.debts[0].minimumCents=null;
  assert.equal(reserveBudget(unknown).feasible,false);assert.equal(makePlans(unknown).alternatives.length,0);
  const stale=fixture();stale.reconciled=false;
  assert.equal(makePlans(stale).alternatives.length,0);assert.ok(missingDebtData(stale).some(x=>x.includes('reconciliation')));
});
test('card utilization uses explicit limits; loans excluded and missing APR/limits flagged',()=>{
  const s=fixture();const u=utilization(s);assert.equal(u.aggregate_utilization_bps,5000);assert.equal(u.cards[0].utilization_percent_display,'50.00%');
  assert.equal(u.credit_score_prediction,null);assert.equal(u.lending_approval_prediction,null);
  s.debts[0].creditLimitCents=null;s.debts[0].aprBps=null;
  assert.equal(utilization(s).aggregate_utilization_bps,null);assert.equal(missingDebtData(s).length,2);
  s.debts[0].creditLimitCents=0;assert.equal(utilization(s).cards[0].utilization_bps,null);
});
test('completed goals and paid debt leave cash unallocated rather than spending twice',()=>{
  const s=fixture();s.goals[0].targetCents=50000;s.debts[0].balanceCents=0;s.accounts[1].balanceCents=0;s.bills=s.bills.filter(b=>!b.debtId);
  validateSnapshot(s,context);const p=makePlans(s);assert.equal(p.alternatives.length,1);
  assert.equal(p.alternatives[0].extra_debt_cents,0);assert.equal(p.alternatives[0].new_goal_contribution_cents,0);
  assert.equal(p.alternatives[0].unallocated_cents,p.budget.available_cents);
});
test('foreign children, duplicate records, invalid dates/amounts and fabricated changes are rejected',()=>{
  for(const mutate of [
    (s:any)=>s.userId='other',(s:any)=>s.version++, (s:any)=>s.accounts[0].connected=false,
    (s:any)=>s.goals[0].userId='other',(s:any)=>s.goals[0].accountId='foreign',
    (s:any)=>s.debts[0].paymentAccountId='foreign',(s:any)=>s.debts[0].accountId='foreign',
    (s:any)=>s.bills[0].debtId='foreign',(s:any)=>s.costChanges[0].billId='foreign',
    (s:any)=>s.costChanges[0].oldCents=1,(s:any)=>s.costChanges.push(s.costChanges[0]),
    (s:any)=>s.accounts[0].balanceCents=0.5,(s:any)=>s.goals[0].targetCents=-1,
    (s:any)=>s.debts[0].aprBps=10001,(s:any)=>s.bills[0].dueDate='2026-02-30',
    (s:any)=>s.debts[0].dueDate='2027-01-01',(s:any)=>s.goals[0].deadline='2020-01-01',
    (s:any)=>s.debts.push(s.debts[0]),(s:any)=>s.accounts.push(s.accounts[0]),
  ]){const s=fixture();mutate(s);assert.throws(()=>validateSnapshot(s,context));}
});
function model(status='completed',headline='Plan analysis complete'):typeof complete {
  return async(_config,messages,available)=>{
    if(available?.length)return {latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:available[0].function.name,type:'function',function:{name:available[0].function.name,arguments:JSON.stringify(args)}}]}};
    const role=messages[0].content!.includes('Your agent_id is goal-allocator;')?'goal-allocator':'debt-readiness';
    const ids=messages.filter(m=>m.role==='tool').flatMap(m=>JSON.parse(m.content!).evidence.map((e:any)=>e.id));
    return {latencyMs:1,message:{role:'assistant',content:JSON.stringify({agent_id:role,status,headline,findings:[],evidence_ids:ids,assumptions:[],missing_data:status==='needs_information'?['APR/limit is missing.']:[],proposed_actions:[],snapshot_version:1})}};
  };
}
test('both agents use six actual scoped tools with same-run dependency and dollar evidence',async()=>{
  const tools=createPlanningTools(async()=>fixture());const budget=new RunBudget();
  const debt=await runDebt({context,config,tools,budget,infer:model()});assert.equal(debt.result.status,'completed');
  const goals=await runGoals({context,config,tools,budget,infer:model(),dependency:{context,result:debt.result,evidence:debt.evidence}});
  assert.equal(goals.result.status,'completed');assert.equal(debt.trace.length+goals.trace.length,6);assert.equal(budget.calls,8);
  assert.ok([...debt.evidence,...goals.evidence].every(e=>e.source_mode==='fixture'));
  const plans=(await tools.compare_plans.execute(args,context,signal())).data as any;
  assert.equal(plans.budget.currency_display.available_cents,'$2185.00');
});
test('missing APR/limit forces needs_information rather than invented values',async()=>{
  const s=fixture();s.debts[0].aprBps=null;s.debts[0].creditLimitCents=null;
  const tools=createPlanningTools(async()=>s);const budget=new RunBudget();
  const bad=await runDebt({context,config,tools,budget,infer:model()});assert.equal(bad.result.status,'failed');
  const good=await runDebt({context,config,tools,budget,infer:model('needs_information')});assert.equal(good.result.status,'needs_information');
  const goals=await runGoals({context,config,tools,budget,infer:model('needs_information'),dependency:{context,result:good.result,evidence:good.evidence}});
  assert.equal(goals.result.status,'needs_information');
});
test('unsupported credit score/approval claims fail result validation; disclaimers allowed',async()=>{
  const claims=['Your credit score will be 750.','Your score will improve by 30 points.','You are approved for the loan.','Approval is guaranteed.'];
  for(const headline of claims){
    assert.ok(unsupportedLendingClaim(headline));
    const r=await runDebt({context,config,tools:createPlanningTools(async()=>fixture()),budget:new RunBudget(),infer:model('completed',headline)});
    assert.equal(r.result.status,'failed');assert.equal(r.events.at(-1)?.message,'INVALID_AGENT_RESULT_LENDING_CLAIM');
  }
  assert.equal(unsupportedLendingClaim('Credit-score changes and lending approval cannot be predicted.'),false);
});
test('identity/amount manipulation rejected, context frozen and disconnect rechecked',async()=>{
  let reads=0;const tools=createPlanningTools(async ctx=>{reads++;assert.ok(Object.isFrozen(ctx));assert.ok(Object.isFrozen(ctx.allowedAccountIds));return fixture();});
  await assert.rejects(tools.allocate_budget.execute({...args,user_id:'other'},context,signal()));
  await assert.rejects(tools.allocate_budget.execute({...args,extra_debt_cents:9000000},context,signal()));assert.equal(reads,0);
  const debt=await runDebt({context,config,tools,budget:new RunBudget(),infer:model()});assert.equal(debt.result.status,'completed');
  const s=fixture();let count=0;const disconnect=createPlanningTools(async()=>{if(++count>1)s.accounts[0].connected=false;return s;});
  assert.equal((await runDebt({context,config,tools:disconnect,budget:new RunBudget(),infer:model()})).result.status,'failed');assert.equal(count,2);
});

test('separate funding accounts cannot implicitly transfer cash or spend investment balances',()=>{
  const s=fixture();s.accounts.push({id:'savings',userId:context.userId,connected:true,kind:'savings',balanceCents:100000,bufferCents:20000});
  s.goals.push({id:'holiday',userId:context.userId,accountId:'savings',title:'Holiday',targetCents:50000,savedCents:10000,deadline:'2027-01-01',priority:2});
  const ctx={...context,allowedAccountIds:[...context.allowedAccountIds,'savings']};validateSnapshot(s,ctx);
  const p=makePlans(s);for(const plan of p.alternatives){
    assert.equal(plan.total_accounted_cents,600000);
    const save=plan.account_allocations.find(a=>a.account_id==='savings')!;
    assert.equal(save.extra_debt_cents,0);assert.equal(save.new_goal_contribution_cents,40000);assert.equal(save.unallocated_cents,30000);
  }
  s.accounts[0].balanceCents=100;assert.equal(makePlans(s).alternatives.length,0);
});
test('bounded cash/goal combinations preserve allocations, caps and genuinely distinct alternatives',()=>{
  for(const cash of [100000,281500,281501,500000,900000])for(const target of [50000,50001,300000]){
    const s=fixture();s.accounts[0].balanceCents=cash;s.goals[0].targetCents=target;
    const p=makePlans(s);const seen=new Set<string>();
    for(const a of p.alternatives){
      assert.equal(a.total_accounted_cents,cash);assert.equal(a.extra_debt_cents+a.new_goal_contribution_cents+a.unallocated_cents,p.budget.available_cents);
      assert.ok(a.debt_allocations[0].first_period_payment_budget_cents<=s.debts[0].balanceCents);
      assert.ok(a.goal_allocations[0].contribution_cents<=Math.max(0,target-s.goals[0].savedCents));
      const key=JSON.stringify([a.extra_debt_cents,a.new_goal_contribution_cents]);assert.ok(!seen.has(key));seen.add(key);
    }
  }
});
test('goal priority is explicit and loans need APR/minimum but do not invent credit limits',()=>{
  const s=fixture();s.goals.push({id:'urgent-goal',userId:context.userId,accountId:'checking',title:'Emergency goal',targetCents:1000000,savedCents:0,deadline:'2027-01-01',priority:1});
  s.goals[0].priority=5;const p=makePlans(s).alternatives.find(a=>a.id==='goal_first')!;
  assert.equal(p.goal_allocations.find(g=>g.goal_id==='urgent-goal')!.contribution_cents,218500);
  s.accounts.push({id:'loan',userId:context.userId,connected:true,kind:'loan',balanceCents:60000,bufferCents:0});
  s.debts.push({id:'loan-debt',userId:context.userId,accountId:'loan',paymentAccountId:'checking',kind:'loan',balanceCents:60000,aprBps:0,minimumCents:10000,creditLimitCents:null,dueDate:'2026-11-25'});
  validateSnapshot(s,{...context,allowedAccountIds:[...context.allowedAccountIds,'loan']});
  assert.equal(missingDebtData(s).length,0);assert.equal(utilization(s).cards.length,1);assert.equal(utilization(s).aggregate_utilization_bps,5000);
});
