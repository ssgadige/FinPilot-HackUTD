import { createHash } from 'node:crypto';
import type { BoundTool,ToolOutput } from '../runtime/tools.ts';
import { missingDebtData } from '../planning/calculations.ts';
import { currencyDisplays,sum } from '../planning/math.ts';
import { stressPlans,validateStress } from './calculations.ts';
import type { StressLoader } from './calculations.ts';
const names=['stress_test_plan','forecast_cash','compare_plans'];
function compact(f:ReturnType<typeof stressPlans>['plans'][number]['baseline']) {
  const lowest=[...f.accounts].sort((a,b)=>a.minimum_balance_cents-b.minimum_balance_cents||a.account_id.localeCompare(b.account_id))[0]?.account_id;
  const accounts=f.accounts.filter(a=>a.account_id===lowest || a.first_cash_shortfall_date || a.first_buffer_breach_date || a.first_goal_funding_breach_date);
  return {...f,accounts,tested_account_count:f.accounts.length,omitted_nonfailing_account_count:f.accounts.length-accounts.length,
    goals:f.goals.filter(g=>g.additional_funding_required_cents>0 || g.existing_earmarks_at_risk_cents>0 || g.deadline_missed_within_horizon)};
}
export function comparison(report:ReturnType<typeof stressPlans>) {
  const comparisons=report.plans.map(p=>({plan_id:p.plan_id,
    baseline_minimum_cash_cents:p.baseline.minimum_total_cash_cents,baseline_first_failure_date:p.baseline.first_failure_date,
    scenarios:p.scenarios.map(s=>({scenario:s.scenario,outcome:s.outcome,first_failure_date:s.first_failure_date,
      first_cash_shortfall_date:s.first_cash_shortfall_date,first_buffer_breach_date:s.first_buffer_breach_date,
      minimum_cash_cents:s.minimum_total_cash_cents,minimum_cash_date:s.minimum_total_cash_date,
      minimum_cash_change_cents:s.minimum_total_cash_cents-p.baseline.minimum_total_cash_cents,
      additional_goal_funding_required_cents:sum(s.goals.map(g=>g.additional_funding_required_cents)),
      goal_changes:s.goals.filter(g=>g.additional_funding_required_cents>0 || g.existing_earmarks_at_risk_cents>0 || g.deadline_missed_within_horizon)}))}));
  const summaries=report.fixed_scenarios.map(setting=>{
    const rows=comparisons.flatMap(p=>p.scenarios.filter(s=>s.scenario===setting.id));
    const first=(dates:(string|null)[])=>dates.filter((d):d is string=>d!==null).sort()[0]??null;
    return {scenario:setting.id,tested_plan_count:rows.length,
      earliest_failure_date:first(rows.map(s=>s.first_failure_date)),earliest_cash_shortfall_date:first(rows.map(s=>s.first_cash_shortfall_date)),
      worst_minimum_cash_cents:rows.length?Math.min(...rows.map(s=>s.minimum_cash_cents)):null,
      no_failure_within_horizon:rows.length>0 && rows.every(s=>s.first_failure_date===null)};
  });
  return {horizon_days:report.horizon_days,baseline_preserved:true,comparisons,scenario_summaries:summaries,probability:null};
}
export function createStressTools(load:StressLoader):Record<string,BoundTool> {
  return Object.fromEntries(names.map(name=>[name,{
    schema:{type:'function',function:{name,description:`${name}: fixed deterministic stress scenarios on authorized candidate plans. Use scope="snapshot". No identity, plan, amount, scenario or probability arguments.`,
      parameters:{type:'object',properties:{scope:{type:'string',enum:['snapshot']}},required:['scope'],additionalProperties:false}}},
    async execute(args,ctx,signal):Promise<ToolOutput> {
      if(args.scope!=='snapshot' || Object.keys(args).length!==1)throw new Error('INVALID_TOOL_ARGUMENTS');
      signal.throwIfAborted();const snapshot=structuredClone(await load(ctx,signal));signal.throwIfAborted();validateStress(snapshot,ctx);
      const report=stressPlans(snapshot);let data:unknown;
      if(name==='forecast_cash')data={horizon_days:30,baselines:report.plans.map(p=>compact(p.baseline)),baseline_preserved:true};
      if(name==='stress_test_plan')data={...report,plans:report.plans.map(p=>({plan_id:p.plan_id,baseline:compact(p.baseline),scenarios:p.scenarios.map(compact)}))};
      if(name==='compare_plans')data=comparison(report);
      const missing=missingDebtData(snapshot.planning);
      if(!report.plans.length)missing.push(report.reason??'No candidate plans available.');
      data=currencyDisplays({...data as object,missing_data:missing});
      const id=createHash('sha256').update(JSON.stringify([ctx.userId,ctx.runId,ctx.snapshotVersion,name,data])).digest('hex').slice(0,24);
      return {data,needsInformation:missing.length>0,evidence:[{id:`calc-${id}`,kind:'calculation',source_id:name,source_mode:snapshot.planning.sourceMode,observed_at:`${snapshot.planning.asOf}T00:00:00.000Z`}],
        assumptions:[
          'Deterministic independent scenarios, not probabilities, predictions or guarantees. Baseline and candidate allocations are never modified.',
          'The tested horizon is 30 days; no failure means no failure within that horizon, not indefinite resilience.',
          'Scheduled income marked confirmed is an explicit assumption, not guaranteed receipt. Unconfirmed income and historical income are not counted.',
          'Expenses occur before receipts on the same day. Goal contributions are earmarked immediately; extra debt is paid on its scheduled due date.',
          'A cash shortfall is a negative actual account balance. Buffer breach subtracts existing/new goal earmarks and the minimum cash buffer; these are distinct failures.',
          'Scenario settings are fixed: all income delayed 7 days, an independent $3000.00 expense on day 7 in the first liquid account by ID, and an independent 25% income reduction rounded down to whole cents.',
          'Existing goal earmarks are protected before new contributions, by priority within each account. Coverage changes are hypothetical funding at risk, not actual withdrawals or goal mutations.',
          'Goal deadline checks use end-of-day account funding and the cash buffer. No new completion date is inferred without future contribution capacity.',
          'All bills/minimums and accepted cost changes use the original plan assumptions once. Nonliquid assets are excluded; no automatic cross-account transfers occur.',
        ]};
    },
  } as BoundTool]));
}
