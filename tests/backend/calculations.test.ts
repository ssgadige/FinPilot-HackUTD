import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amortize,forecast,recurring,normalize,utilization,cashFlow } from '../../src/server/tools/finance';
import { loanCalculation,savingsCalculation } from '../../src/server/tools/finance/calculators';
test('FP-13: exact-cent interest/payment examples, zero/missing denominators and conservation',()=>{
 assert.equal(amortize(10000,1200,10100).interest_cents,100);assert.equal(amortize(10000,0,1000).payoff_months,10);assert.equal(amortize(10000,1200,50).negative_amortization,true);
 const loan=loanCalculation(1000000,600,36,0);assert.equal(loan.payment_cents,30422);assert.equal(loan.remaining_cents,0);assert.equal(loan.schedule.length,36);assert.equal(loan.schedule.reduce((n,r)=>n+r.principal_cents,0),1000000);
 assert.equal(loanCalculation(100000,0,10,0).interest_cents,0);assert.ok(loanCalculation(1000000,600,36,10000).payoff_months<36);
 assert.equal(savingsCalculation(800000,240000,12,0).contribution_cents,46667);assert.equal(savingsCalculation(800000,800000,12,0).contribution_cents,0);assert.ok(savingsCalculation(800000,240000,12,500).projected_cents>=800000);
 assert.equal(utilization(5000,10000).utilization_bps,5000);assert.equal(utilization(5000,null).utilization_bps,null);assert.equal(normalize(12000,'annual'),1000);
 const rows=[{kind:'checking',delta_cents:10000,category:'income',transfer_group:null},{kind:'checking',delta_cents:-5000,category:'transfer',transfer_group:'x'},{kind:'credit_card',delta_cents:-5000,category:'transfer',transfer_group:'x'},{kind:'credit_card',delta_cents:2000,category:'shopping',transfer_group:null}];assert.deepEqual(cashFlow(rows),{income_cents:10000,spending_cents:2000,savings_rate_bps:8000});assert.equal(cashFlow([]).savings_rate_bps,null);
});
test('FP-13: dated stress, delayed income, recurring evidence and invalid ranges',()=>{
 const items=[{day_of_month:3,amount_cents:5000,direction:'expense' as const},{day_of_month:15,amount_cents:8000,direction:'income' as const}];const f=forecast(10000,'2026-01-01',30,items,1000,2,50);assert.equal(f.dated_balances[2].balance_cents,4000);assert.equal(f.dated_balances[16].balance_cents,8000);assert.equal(f.evidence_id,forecast(10000,'2026-01-01',30,items,1000,2,50).evidence_id);
 const recurrence=recurring(['2026-01-05','2026-02-05','2026-03-05'].map(posted_date=>({merchant:'Fixture service',posted_date,delta_cents:1200})));assert.equal(recurrence.candidates[0].monthly_equivalent_cents,1200);
 assert.throws(()=>forecast(1.5,'2026-01-01',30,[]),{code:'invalid_range'});assert.throws(()=>forecast(100,'2026-02-30',30,[]),{code:'invalid_date'});assert.throws(()=>forecast(100,'2026-01-01',30,[],0,61),{code:'invalid_range'});assert.throws(()=>amortize(10000,10001,500),{code:'invalid_range'});assert.throws(()=>loanCalculation(1000,500,0,0),{code:'invalid_range'});for(const c of ['constructor','toString','__proto__'])assert.throws(()=>normalize(1000,c),{code:'invalid_cadence'});
});
