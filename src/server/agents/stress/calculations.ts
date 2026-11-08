import type { PlanningSnapshot } from '../planning/types.ts';
import type { Context } from '../runtime/tools.ts';
import { validateSnapshot, makePlans, liquid, reservedObligations } from '../planning/calculations.ts';
import { integer, plusDays, validDate, sum, safe } from '../planning/math.ts';
export interface ScheduledIncome { id:string; userId:string; accountId:string; date:string; amountCents:number; confirmed:boolean; }
export interface StressSnapshot { planning:PlanningSnapshot; incomes:ScheduledIncome[]; }
export type StressLoader=(context:Context,signal:AbortSignal)=>Promise<StressSnapshot>;
export type Candidate=ReturnType<typeof makePlans>['alternatives'][number];
export const SCENARIOS=[
  {id:'delayed_income',delay_days:7,expense_cents:0,income_drop_bps:0},
  {id:'surprise_expense',delay_days:0,expense_cents:300000,income_drop_bps:0},
  {id:'reduced_income',delay_days:0,expense_cents:0,income_drop_bps:2500},
] as const;
export type ScenarioId='baseline'|typeof SCENARIOS[number]['id'];
export function validateStress(s:StressSnapshot,ctx:Context) {
  validateSnapshot(s.planning,ctx);
  if (!Array.isArray(s.incomes) || s.incomes.length>100 || new Set(s.incomes.map(i=>i.id)).size!==s.incomes.length) throw new Error('INVALID_STRESS_INPUT');
  const horizon=plusDays(s.planning.asOf,30);
  for(const i of s.incomes) {
    if(typeof i.id!=='string' || !i.id || i.id.length>100 || i.userId!==ctx.userId || !s.planning.accounts.some(a=>a.id===i.accountId && liquid(a.kind))) throw new Error('RECORD_SCOPE');
    integer(i.amountCents,1);
    if(typeof i.confirmed!=='boolean' || !validDate(i.date) || i.date<=s.planning.asOf || i.date>horizon) throw new Error('INVALID_STRESS_INPUT');
  }
}
export function forecastCandidate(snapshot:StressSnapshot,plan:Candidate,scenario:ScenarioId) {
  const s=snapshot.planning;const horizon=plusDays(s.asOf,30);
  const setting=SCENARIOS.find(x=>x.id===scenario);
  if(scenario!=='baseline' && !setting)throw new Error('INVALID_STRESS_INPUT');
  const cashAccounts=s.accounts.filter(a=>liquid(a.kind));
  const balances=new Map(cashAccounts.map(a=>[a.id,a.balanceCents]));
  const goals=[...s.goals].sort((a,b)=>a.priority-b.priority||a.deadline.localeCompare(b.deadline)||a.id.localeCompare(b.id));
  const oldGoals=new Map(cashAccounts.map(a=>[a.id,sum(goals.filter(g=>g.accountId===a.id).map(g=>g.savedCents))]));
  const newGoals=new Map(cashAccounts.map(a=>[a.id,sum(plan.goal_allocations.filter(g=>g.account_id===a.id).map(g=>g.contribution_cents))]));
  const events=reservedObligations(s).obligations.map((o,i)=>({id:`obligation-${i}`,accountId:o.accountId,date:o.date,delta:-o.amountCents}));
  for(const d of plan.debt_allocations) {
    const debt=s.debts.find(x=>x.id===d.debt_id)!;
    events.push({id:`extra-${d.debt_id}`,accountId:d.payment_account_id,date:debt.dueDate,delta:-d.extra_payment_cents});
  }
  let omittedIncome=0;let incomeCounted=0;
  for(const income of snapshot.incomes.filter(i=>i.confirmed)) {
    const date=setting?.delay_days?plusDays(income.date,setting.delay_days):income.date;
    if(date>horizon){omittedIncome=sum([omittedIncome,income.amountCents]);continue;}
    const amount=setting?.income_drop_bps?safe(BigInt(income.amountCents)*BigInt(10000-setting.income_drop_bps)/10000n):income.amountCents;
    incomeCounted=sum([incomeCounted,amount]);events.push({id:`income-${income.id}`,accountId:income.accountId,date,delta:amount});
  }
  const shockAccount=[...cashAccounts].sort((a,b)=>a.id.localeCompare(b.id))[0]?.id;
  const shockDate=plusDays(s.asOf,7);
  if(setting?.expense_cents && shockAccount)events.push({id:'surprise-expense',accountId:shockAccount,date:shockDate,delta:-setting.expense_cents});
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.delta-b.delta||a.id.localeCompare(b.id));
  const stats=new Map(cashAccounts.map(a=>[a.id,{account_id:a.id,minimum_balance_cents:a.balanceCents,minimum_balance_date:s.asOf,
    minimum_buffer_headroom_cents:sum([a.balanceCents,-oldGoals.get(a.id)!,-newGoals.get(a.id)!,-a.bufferCents]),
    first_cash_shortfall_date:null as string|null,first_buffer_breach_date:null as string|null,first_goal_funding_breach_date:null as string|null}]));
  let minTotal=sum([...balances.values()]);let minTotalDate=s.asOf;
  const observe=(date:string)=>{
    const total=sum([...balances.values()]);if(total<minTotal){minTotal=total;minTotalDate=date;}
    for(const a of cashAccounts){
      const n=balances.get(a.id)!;const row=stats.get(a.id)!;
      if(n<row.minimum_balance_cents){row.minimum_balance_cents=n;row.minimum_balance_date=date;}
      const goalReserve=sum([oldGoals.get(a.id)!,newGoals.get(a.id)!]);const headroom=sum([n,-goalReserve,-a.bufferCents]);
      row.minimum_buffer_headroom_cents=Math.min(row.minimum_buffer_headroom_cents,headroom);
      if(n<0 && row.first_cash_shortfall_date===null)row.first_cash_shortfall_date=date;
      if(headroom<0 && row.first_buffer_breach_date===null)row.first_buffer_breach_date=date;
      if(n<goalReserve && row.first_goal_funding_breach_date===null)row.first_goal_funding_breach_date=date;
    }
  };
  observe(s.asOf);
  const daily=new Map<string,Map<string,number>>();let cursor=0;
  for(let day=0;day<=30;day++){
    const date=plusDays(s.asOf,day);
    while(cursor<events.length && events[cursor].date===date){
      const e=events[cursor++];balances.set(e.accountId,sum([balances.get(e.accountId)!,e.delta]));observe(date);
    }
    daily.set(date,new Map(balances));
  }
  const coverage=(state:Map<string,number>)=>{
    const remaining=new Map(cashAccounts.map(a=>[a.id,Math.max(0,sum([state.get(a.id)!,-a.bufferCents]))]));
    const covered=new Map(goals.map(g=>[g.id,{existing:0,contribution:0}]));
    // Existing earmarks are protected first, then new contributions by priority.
    for(const g of goals){const n=Math.min(g.savedCents,remaining.get(g.accountId)!);covered.get(g.id)!.existing=n;remaining.set(g.accountId,remaining.get(g.accountId)!-n);}
    for(const g of goals){const proposed=plan.goal_allocations.find(x=>x.goal_id===g.id)!.contribution_cents;
      const n=Math.min(proposed,remaining.get(g.accountId)!);covered.get(g.id)!.contribution=n;remaining.set(g.accountId,remaining.get(g.accountId)!-n);}
    return covered;
  };
  const endingCoverage=coverage(balances);
  const goalChanges=goals.map(g=>{
    const proposed=plan.goal_allocations.find(x=>x.goal_id===g.id)!;const covered=endingCoverage.get(g.id)!;
    const after=Math.max(0,g.targetCents-covered.existing-covered.contribution);
    const atDeadline=daily.get(g.deadline);const missed=atDeadline?sum(Object.values(coverage(atDeadline).get(g.id)!))<g.targetCents:false;
    return {goal_id:g.id,deadline:g.deadline,baseline_remaining_cents:proposed.remaining_cents,stressed_remaining_cents:after,
      additional_funding_required_cents:after-proposed.remaining_cents,existing_earmarks_at_risk_cents:g.savedCents-covered.existing,
      planned_contribution_cents:proposed.contribution_cents,funded_contribution_cents:covered.contribution,
      deadline_missed_within_horizon:missed,deadline_missed_date:missed?g.deadline:null,estimated_deadline_shift_days:null,
      deadline_note:'No new completion date inferred; future contribution capacity is unknown.'};
  });
  const accountRows=[...stats.values()].map(a=>({...a,closing_balance_cents:balances.get(a.account_id)!}));
  const earliest=(dates:(string|null)[])=>dates.filter((d):d is string=>d!==null).sort()[0]??null;
  const cashFailure=earliest(accountRows.map(a=>a.first_cash_shortfall_date));
  const bufferFailure=earliest(accountRows.map(a=>a.first_buffer_breach_date));
  const goalFailure=earliest(accountRows.map(a=>a.first_goal_funding_breach_date));
  const firstFailure=earliest([cashFailure,bufferFailure,goalFailure,...goalChanges.map(g=>g.deadline_missed_date)]);
  return {plan_id:plan.id,scenario,horizon_start:s.asOf,horizon_end:horizon,outcome:firstFailure?'failed_constraints':'no_failure_within_horizon',
    first_failure_date:firstFailure,first_cash_shortfall_date:cashFailure,first_buffer_breach_date:bufferFailure,first_goal_funding_breach_date:goalFailure,
    minimum_total_cash_cents:minTotal,minimum_total_cash_date:minTotalDate,closing_total_cash_cents:sum([...balances.values()]),
    income_counted_cents:incomeCounted,income_delayed_beyond_horizon_cents:omittedIncome,
    shock_account_id:setting?.expense_cents?shockAccount??null:null,shock_date:setting?.expense_cents?shockDate:null,
    accounts:accountRows,goals:goalChanges,probability:null,guaranteed_resilience:false};
}
export function stressPlans(snapshot:StressSnapshot) {
  const candidates=makePlans(snapshot.planning);
  return {baseline_preserved:true,horizon_days:30,fixed_scenarios:SCENARIOS.map(s=>({...s})),reason:candidates.reason,
    plans:candidates.alternatives.map(plan=>{
      const baseline=forecastCandidate(snapshot,plan,'baseline');
      const scenarios=SCENARIOS.map(s=>forecastCandidate(snapshot,plan,s.id));
      return {plan_id:plan.id,baseline,scenarios};
    })};
}
