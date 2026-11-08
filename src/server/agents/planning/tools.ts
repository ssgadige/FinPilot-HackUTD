import { createHash } from 'node:crypto';
import type { BoundTool, ToolOutput } from '../runtime/tools.ts';
import type { PlanningLoader } from './types.ts';
import { validateSnapshot, missingDebtData, reserveBudget, makePlans, utilization } from './calculations.ts';
import { currencyDisplays, simulatePayoff, sum } from './math.ts';
const names=['get_debt_summary','simulate_debt_payoff','calculate_utilization','get_goals','allocate_budget','compare_plans'];
const assumptions=[
  'All amounts are integer USD cents; use currency_display for dollar prose.',
  'Only current checking/savings/wallet cash is spendable; no future income, CD maturity or investments are counted.',
  'Bills, required minimums, cash buffers and already-saved goal money are reserved before discretionary allocation.',
  'Accepted effective cost changes replace a future bill once; proposed savings never add cash and realized savings remain zero.',
  'Each alternative is mutually exclusive; never combine allocations from different alternatives.',
  'Payoff estimates use fixed nominal APR/12 and half-up monthly interest; interest accrues before payment, no fees or new charges.',
  'Extra debt payment is one-time in the first period; future fixed minimums are an assumption, not verified future affordability.',
  'Goal remaining-monthly requirements are calculations, not promises of future capacity or completion.',
  'No credit-score prediction, score-point gain or lending approval is calculated. All actions require confirmation.',
];
export function createPlanningTools(load: PlanningLoader): Record<string,BoundTool> {
  return Object.fromEntries(names.map(name=>[name,{
    schema:{type:'function',function:{name,description:`${name}: deterministic authorized debt/goal planning. Use scope="snapshot". No identity, account, plan or payment amount arguments.`,
      parameters:{type:'object',properties:{scope:{type:'string',enum:['snapshot']}},required:['scope'],additionalProperties:false}}},
    async execute(args,ctx,signal):Promise<ToolOutput> {
      if(args.scope!=='snapshot' || Object.keys(args).length!==1)throw new Error('INVALID_TOOL_ARGUMENTS');
      signal.throwIfAborted();const s=structuredClone(await load(ctx,signal));signal.throwIfAborted();validateSnapshot(s,ctx);
      const missing=missingDebtData(s);let data:unknown;
      const budget=reserveBudget(s);
      if(name==='get_debt_summary')data={total_debt_cents:sum(s.debts.map(d=>d.balanceCents)),debts:s.debts.map(d=>({debt_id:d.id,kind:d.kind,balance_cents:d.balanceCents,apr_bps:d.aprBps,apr_percent_display:d.aprBps===null?null:`${Math.floor(d.aprBps/100)}.${String(d.aprBps%100).padStart(2,'0')}%`,minimum_cents:d.minimumCents,
        credit_limit_cents:d.creditLimitCents,due_date:d.dueDate})),budget,missing_data:missing,credit_score_prediction:null,lending_approval_prediction:null};
      if(name==='calculate_utilization')data={...utilization(s),missing_data:missing.filter(m=>m.includes('Credit limit'))};
      if(name==='simulate_debt_payoff')data={baseline:s.debts.map(d=>({debt_id:d.id,...simulatePayoff(d.balanceCents,d.aprBps,d.minimumCents,budget.committed_debt_payments.find(p=>p.debt_id===d.id)!.committed_cents-Math.min(d.balanceCents,d.minimumCents??0))})),
        alternatives:makePlans(s).alternatives.map(p=>({id:p.id,extra_debt_cents:p.extra_debt_cents,new_goal_contribution_cents:p.new_goal_contribution_cents,
          baseline_total_interest_cents:p.baseline_total_interest_cents,estimated_total_interest_cents:p.estimated_total_interest_cents,
          estimated_interest_reduction_cents:p.estimated_interest_reduction_cents,estimated_debt_free_date:p.estimated_debt_free_date,
          debt_payoffs:p.debt_allocations})),missing_data:missing};
      if(name==='get_goals')data={goals:s.goals.map(g=>({goal_id:g.id,title:g.title,target_cents:g.targetCents,saved_cents:g.savedCents,remaining_cents:Math.max(0,g.targetCents-g.savedCents),deadline:g.deadline,priority:g.priority})),
        budget,missing_data:missing};
      if(name==='allocate_budget' || name==='compare_plans') {
        const plans=makePlans(s);
        data={...plans,missing_data:missing,selection:'Choose one mutually exclusive alternative; no automatic acceptance.',
          timelines:'Only returned payoff dates are estimates under fixed-payment assumptions; no lending approval or credit score can be inferred.'};
      }
      data=currencyDisplays(data);
      const id=createHash('sha256').update(JSON.stringify([ctx.userId,ctx.runId,ctx.snapshotVersion,name,data])).digest('hex').slice(0,24);
      return {data,needsInformation:missing.length>0,evidence:[{id:`calc-${id}`,kind:'calculation',source_id:name,source_mode:s.sourceMode,observed_at:`${s.asOf}T00:00:00.000Z`}],assumptions};
    },
  } as BoundTool]));
}
