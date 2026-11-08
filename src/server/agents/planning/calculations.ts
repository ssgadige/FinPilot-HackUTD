import type { Context } from '../runtime/tools.ts';
import type { PlanningSnapshot, Debt } from './types.ts';
import { integer, validDate, plusDays, plusMonths, sum, safe, simulatePayoff } from './math.ts';
export const liquid = (kind:string) => ['checking','savings','wallet'].includes(kind);
export function validateSnapshot(s: PlanningSnapshot, ctx: Context) {
  if (s.userId!==ctx.userId || s.version!==ctx.snapshotVersion || !validDate(s.asOf) || !['live','fixture','cached'].includes(s.sourceMode)) throw new Error('SNAPSHOT_SCOPE');
  if (typeof s.reconciled!=='boolean') throw new Error('INVALID_PLANNING_INPUT');
  if (s.accounts.length>30 || s.debts.length>10 || s.goals.length>10 || s.bills.length>100 || s.costChanges.length>100) throw new Error('INVALID_PLANNING_INPUT');
  for (const rows of [s.accounts,s.debts,s.goals,s.bills,s.costChanges]) {
    if (new Set(rows.map(r=>r.id)).size!==rows.length || rows.some(r=>r.userId!==ctx.userId || typeof r.id!=='string' || !r.id || r.id.length>100)) throw new Error('RECORD_SCOPE');
  }
  const accounts=new Map(s.accounts.map(a=>[a.id,a])); const horizon=plusDays(s.asOf,30);
  if (s.accounts.some(a=>!a.connected || !ctx.allowedAccountIds.includes(a.id)) || ctx.allowedAccountIds.some(id=>!accounts.has(id))) throw new Error('ACCOUNT_SCOPE');
  for (const a of s.accounts) {
    if (!['checking','savings','wallet','credit_card','loan','cd','brokerage','ira'].includes(a.kind)) throw new Error('INVALID_PLANNING_INPUT');
    integer(a.balanceCents,liquid(a.kind)?-Number.MAX_SAFE_INTEGER:0); integer(a.bufferCents);
    if (!liquid(a.kind) && a.bufferCents) throw new Error('INVALID_PLANNING_INPUT');
  }
  for (const d of s.debts) {
    const a=accounts.get(d.accountId); const paying=accounts.get(d.paymentAccountId);
    if (!a || !paying || !liquid(paying.kind) || !['credit_card','loan'].includes(d.kind) || a.kind!==d.kind || a.balanceCents!==d.balanceCents) throw new Error('RECORD_SCOPE');
    integer(d.balanceCents); if (d.aprBps!==null) integer(d.aprBps,0,10000);
    if (d.minimumCents!==null) integer(d.minimumCents);
    if (d.creditLimitCents!==null) integer(d.creditLimitCents);
    if (!validDate(d.dueDate) || d.dueDate<s.asOf || d.dueDate>horizon) throw new Error('INVALID_PLANNING_INPUT');
  }
  if (new Set(s.debts.map(d=>d.accountId)).size!==s.debts.length || s.accounts.some(a=>['credit_card','loan'].includes(a.kind) && !s.debts.some(d=>d.accountId===a.id))) throw new Error('RECORD_SCOPE');
  for (const g of s.goals) {
    if (!accounts.has(g.accountId) || !liquid(accounts.get(g.accountId)!.kind)) throw new Error('RECORD_SCOPE');
    integer(g.targetCents,1); integer(g.savedCents); integer(g.priority,1,5);
    if (!validDate(g.deadline) || g.deadline<s.asOf || g.deadline>plusMonths(s.asOf,120) || typeof g.title!=='string' || g.title.length>120) throw new Error('INVALID_PLANNING_INPUT');
  }
  for (const b of s.bills) {
    if (!accounts.has(b.accountId) || !liquid(accounts.get(b.accountId)!.kind)) throw new Error('RECORD_SCOPE');
    integer(b.amountCents);
    if (!validDate(b.dueDate) || b.dueDate<s.asOf || b.dueDate>horizon) throw new Error('INVALID_PLANNING_INPUT');
    if (b.debtId!==undefined && !s.debts.some(d=>d.id===b.debtId && d.paymentAccountId===b.accountId && b.dueDate<=d.dueDate)) throw new Error('RECORD_SCOPE');
  }
  for (const d of s.debts) if (sum(s.bills.filter(b=>b.debtId===d.id).map(b=>b.amountCents))>d.balanceCents) throw new Error('INVALID_PLANNING_INPUT');
  const changedBills=new Set<string>();
  for (const c of s.costChanges) {
    const b=s.bills.find(b=>b.id===c.billId);
    if (!b || b.accountId!==c.accountId || b.debtId!==undefined || c.oldCents!==b.amountCents || changedBills.has(c.billId)) throw new Error('RECORD_SCOPE');
    changedBills.add(c.billId);integer(c.oldCents);integer(c.newCents);
    if (typeof c.accepted!=='boolean' || !validDate(c.effectiveDate)) throw new Error('INVALID_PLANNING_INPUT');
  }
}
export function missingDebtData(s: PlanningSnapshot): string[] {
  return [...(!s.reconciled?['Snapshot balances need reconciliation before allocation.']:[]), ...s.debts.flatMap(d=>[
    ...(d.balanceCents>0 && d.aprBps===null?[`APR missing for ${d.id}; no interest/payoff estimate.`]:[]),
    ...(d.balanceCents>0 && d.minimumCents===null?[`Minimum payment missing for ${d.id}; no discretionary allocations.`]:[]),
    ...(d.kind==='credit_card' && !d.creditLimitCents?[`Credit limit missing/zero for ${d.id}; utilization is unknown.`]:[]),
  ])];
}
export function reserveBudget(s: PlanningSnapshot) {
  const adjusted=s.bills.map(b=>{
    const change=s.costChanges.find(c=>c.billId===b.id && c.accepted && c.effectiveDate<=b.dueDate);
    return {...b,amountCents:change?.newCents??b.amountCents};
  });
  const minimum=(d:Debt)=>Math.min(d.balanceCents,d.minimumCents??0);
  const coverage=new Map(s.debts.map(d=>[d.id,Math.min(minimum(d),sum(adjusted.filter(b=>b.debtId===d.id).map(b=>b.amountCents)))]));
  const obligations=[...adjusted.map(b=>({accountId:b.accountId,date:b.dueDate,amountCents:b.amountCents})),
    ...s.debts.map(d=>({accountId:d.paymentAccountId,date:d.dueDate,amountCents:minimum(d)-coverage.get(d.id)!}))];
  const accounts=s.accounts.filter(a=>liquid(a.kind)).map(a=>{
    const payments=sum(obligations.filter(o=>o.accountId===a.id).map(o=>o.amountCents));
    const earmarked=sum(s.goals.filter(g=>g.accountId===a.id).map(g=>g.savedCents));
    const reserved=sum([payments,earmarked,a.bufferCents]);const free=sum([a.balanceCents,-reserved]);
    return {account_id:a.id,starting_cash_cents:a.balanceCents,obligations_reserved_cents:payments,
      buffer_reserved_cents:a.bufferCents,existing_goal_savings_reserved_cents:earmarked,
      protected_after_obligations_cents:sum([a.bufferCents,earmarked]),
      unreserved_cents:free,available_cents:Math.max(0,free),deficit_cents:Math.max(0,-free)};
  });
  const unknownMinimum=s.debts.some(d=>d.balanceCents>0 && d.minimumCents===null);
  const feasible=s.reconciled && !unknownMinimum && accounts.every(a=>a.deficit_cents===0);
  const existingBillMinimum=sum([...coverage.values()]);
  return {as_of:s.asOf,horizon_end:plusDays(s.asOf,30),feasible,accounts,
    liquid_cash_cents:sum(accounts.map(a=>a.starting_cash_cents)),
    bills_reserved_cents:sum(adjusted.map(b=>b.amountCents))-existingBillMinimum,
    minimum_payments_reserved_cents:sum(s.debts.map(minimum)),
    buffer_reserved_cents:sum(accounts.map(a=>a.buffer_reserved_cents)),
    existing_goal_savings_reserved_cents:sum(accounts.map(a=>a.existing_goal_savings_reserved_cents)),
    total_reserved_cents:sum(accounts.map(a=>sum([a.obligations_reserved_cents,a.buffer_reserved_cents,a.existing_goal_savings_reserved_cents]))),
    protected_after_obligations_cents:sum(accounts.map(a=>a.protected_after_obligations_cents)),
    available_cents:feasible?sum(accounts.map(a=>a.available_cents)):0,
    confirmed_future_cost_reduction_cents:sum(s.bills.map((b,i)=>b.amountCents-adjusted[i].amountCents)),
    ignored_unconfirmed_change_ids:s.costChanges.filter(c=>!c.accepted).map(c=>c.id),
    realized_savings_cents:0,future_income_counted_cents:0,
    committed_debt_payments:s.debts.map(d=>({debt_id:d.id,committed_cents:Math.max(minimum(d),sum(adjusted.filter(b=>b.debtId===d.id).map(b=>b.amountCents)))})),
    reason:!s.reconciled?'Balances are not reconciled.':unknownMinimum?'Required minimum is unknown.':!feasible?'An account cannot cover its reserved obligations/buffer.':null};
}
export function utilization(s: PlanningSnapshot) {
  const cards=s.debts.filter(d=>d.kind==='credit_card');
  const rows=cards.map(d=>({debt_id:d.id,balance_cents:d.balanceCents,credit_limit_cents:d.creditLimitCents,
    utilization_bps:d.creditLimitCents?safe((BigInt(d.balanceCents)*10000n+BigInt(d.creditLimitCents)/2n)/BigInt(d.creditLimitCents)):null}));
  const unknown=rows.some(r=>r.utilization_bps===null);
  const limit=sum(rows.map(r=>r.credit_limit_cents??0)); const balance=sum(rows.map(r=>r.balance_cents));
  return {cards:rows.map(r=>({...r,utilization_percent_display:r.utilization_bps===null?null:`${Math.floor(r.utilization_bps/100)}.${String(r.utilization_bps%100).padStart(2,'0')}%`})),
    aggregate_utilization_bps:unknown || !limit?null:safe((BigInt(balance)*10000n+BigInt(limit)/2n)/BigInt(limit)),
    aggregate_utilization_percent_display:unknown || !limit?null:(()=>{const n=safe((BigInt(balance)*10000n+BigInt(limit)/2n)/BigInt(limit));return `${Math.floor(n/100)}.${String(n%100).padStart(2,'0')}%`;})(),
    credit_score_prediction:null,lending_approval_prediction:null};
}
export function makePlans(s: PlanningSnapshot) {
  const budget=reserveBudget(s);
  if (!budget.feasible || !budget.available_cents) return {budget,alternatives:[],reason:budget.reason??'No unreserved cash; do not invent allocations.'};
  const debts=[...s.debts].sort((a,b)=>(b.aprBps??-1)-(a.aprBps??-1)||a.id.localeCompare(b.id));
  const goals=[...s.goals].sort((a,b)=>a.priority-b.priority||a.deadline.localeCompare(b.deadline)||a.id.localeCompare(b.id));
  const baseline=s.debts.map(d=>simulatePayoff(d.balanceCents,d.aprBps,d.minimumCents,budget.committed_debt_payments.find(p=>p.debt_id===d.id)!.committed_cents-Math.min(d.balanceCents,d.minimumCents??0)));
  const baselineInterest=baseline.every(p=>p.status==='paid_off')?sum(baseline.map(p=>p.total_interest_cents!)):null;
  const strategies=['debt_first','goal_first','balanced'] as const;
  const alternatives=strategies.map(strategy=>{
    const debtExtra=new Map(s.debts.map(d=>[d.id,0]));const goalExtra=new Map(s.goals.map(g=>[g.id,0]));
    const accountAllocations=budget.accounts.map(a=>{
      let free=a.available_cents;
      const payDebts=(limit:number)=>{
        let remaining=Math.min(limit,free);
        for (const d of debts.filter(d=>d.paymentAccountId===a.account_id)) {
          const committed=budget.committed_debt_payments.find(p=>p.debt_id===d.id)!.committed_cents;
          const need=Math.max(0,d.balanceCents-committed-debtExtra.get(d.id)!);
          const amount=Math.min(need,remaining);debtExtra.set(d.id,debtExtra.get(d.id)!+amount);remaining-=amount;free-=amount;
        }
      };
      const fundGoals=(limit:number)=>{
        let remaining=Math.min(limit,free);
        for (const g of goals.filter(g=>g.accountId===a.account_id)) {
          const need=Math.max(0,g.targetCents-g.savedCents-goalExtra.get(g.id)!);
          const amount=Math.min(need,remaining);goalExtra.set(g.id,goalExtra.get(g.id)!+amount);remaining-=amount;free-=amount;
        }
      };
      if (strategy==='balanced') {payDebts(Math.floor(free/2));fundGoals(free);payDebts(free);}
      else if (strategy==='debt_first') {payDebts(free);fundGoals(free);}
      else {fundGoals(free);payDebts(free);}
      const extraDebt=sum(debts.filter(d=>d.paymentAccountId===a.account_id).map(d=>debtExtra.get(d.id)!));
      const goalContribution=sum(goals.filter(g=>g.accountId===a.account_id).map(g=>goalExtra.get(g.id)!));
      if (sum([extraDebt,goalContribution,free])!==a.available_cents) throw new Error('ALLOCATION_CONSERVATION');
      return {...a,extra_debt_cents:extraDebt,new_goal_contribution_cents:goalContribution,unallocated_cents:free,
        projected_closing_cash_cents:sum([a.starting_cash_cents,-a.obligations_reserved_cents,-extraDebt])};
    });
    const debtAllocations=debts.map(d=>{
      const extra=debtExtra.get(d.id)!;const minimum=Math.min(d.balanceCents,d.minimumCents??0);
      const committed=budget.committed_debt_payments.find(p=>p.debt_id===d.id)!.committed_cents;
      const projection=simulatePayoff(d.balanceCents,d.aprBps,d.minimumCents,sum([extra,committed-minimum]));
      return {debt_id:d.id,payment_account_id:d.paymentAccountId,minimum_reserved_cents:minimum,committed_payment_cents:committed,extra_payment_cents:extra,
        first_period_payment_budget_cents:sum([committed,extra]),projection,
        estimated_payoff_date:projection.payoff_months===null?null:projection.payoff_months===0?s.asOf:plusMonths(d.dueDate,projection.payoff_months-1)};
    });
    const goalAllocations=goals.map(g=>{
      const contribution=goalExtra.get(g.id)!;const remaining=Math.max(0,g.targetCents-g.savedCents-contribution);
      const deadline=new Date(g.deadline);const now=new Date(s.asOf);
      const months=Math.max(0,(deadline.getUTCFullYear()-now.getUTCFullYear())*12+deadline.getUTCMonth()-now.getUTCMonth()+(deadline.getUTCDate()>now.getUTCDate()?1:0));
      return {goal_id:g.id,account_id:g.accountId,priority:g.priority,deadline:g.deadline,
        existing_saved_cents:g.savedCents,contribution_cents:contribution,saved_after_contribution_cents:sum([g.savedCents,contribution]),remaining_cents:remaining,
        deadline_met_now:remaining===0,months_remaining:months,
        required_future_monthly_cents:months?safe((BigInt(remaining)+BigInt(months)-1n)/BigInt(months)):remaining?null:0,
        projected_completion_date:remaining===0?s.asOf:null};
    });
    const extraDebt=sum(accountAllocations.map(a=>a.extra_debt_cents)); const newGoals=sum(accountAllocations.map(a=>a.new_goal_contribution_cents));
    const unallocated=sum(accountAllocations.map(a=>a.unallocated_cents));
    const total=sum([budget.bills_reserved_cents,budget.minimum_payments_reserved_cents,budget.buffer_reserved_cents,budget.existing_goal_savings_reserved_cents,extraDebt,newGoals,unallocated]);
    if (total!==budget.liquid_cash_cents) throw new Error('ALLOCATION_CONSERVATION');
    return {id:strategy,account_allocations:accountAllocations,debt_allocations:debtAllocations,goal_allocations:goalAllocations,
      extra_debt_cents:extraDebt,new_goal_contribution_cents:newGoals,unallocated_cents:unallocated,total_accounted_cents:total,
      projected_closing_cash_cents:sum(accountAllocations.map(a=>a.projected_closing_cash_cents)),
      baseline_total_interest_cents:baselineInterest,
      estimated_interest_reduction_cents:baselineInterest!==null && debtAllocations.every(d=>d.projection.status==='paid_off')?baselineInterest-sum(debtAllocations.map(d=>d.projection.total_interest_cents!)):null,
      estimated_total_interest_cents:debtAllocations.every(d=>d.projection.status==='paid_off')?sum(debtAllocations.map(d=>d.projection.total_interest_cents!)):null,
      estimated_debt_free_date:debtAllocations.every(d=>d.estimated_payoff_date!==null)?debtAllocations.map(d=>d.estimated_payoff_date!).sort().at(-1)??s.asOf:null,
      total_remaining_goal_cents:sum(goalAllocations.map(g=>g.remaining_cents)),proposal_only:true,requires_confirmation:true};
  });
  const seen=new Set<string>();
  return {budget,alternatives:alternatives.filter(p=>{
    const key=JSON.stringify([p.debt_allocations.map(d=>d.extra_payment_cents),p.goal_allocations.map(g=>g.contribution_cents)]);
    if(seen.has(key))return false;seen.add(key);return true;
  }),reason:null};
}
