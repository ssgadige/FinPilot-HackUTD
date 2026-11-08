import { createHash } from 'node:crypto';
import { fail } from '../../errors.ts';
export function integer(n: number,min=0,max=100_000_000_000): number {
  if (!Number.isSafeInteger(n) || n<min || n>max) fail(400,'invalid_range','Value outside supported range'); return n;
}
export function date(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0,10)!==s) fail(400,'invalid_date','Expected valid YYYY-MM-DD'); return s;
}
export function addDays(s: string,n: number) { const d = new Date(date(s)+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function calculation<T>(kind: string,input: unknown,result: T,assumptions: string[]) {
  return { ...result,evidence_id:'calc-'+createHash('sha256').update(JSON.stringify({kind,input})).digest('hex').slice(0,24),source_mode:'fixture' as const,assumptions };
}
export interface Scheduled { day_of_month: number; amount_cents: number; direction: 'income'|'expense'; }
export interface IncomeShift {scheduled_item_id:string;original_date:string;delayed_date:string;}
export function forecast(balance: number,start: string,days: number,items: (Scheduled & {id?:string})[],expense=0,delay=0,drop=0,nextIncomeDelays: number[] = [],shifts:IncomeShift[] = []) {
  integer(balance,-100_000_000_000); date(start); integer(days,1,90); integer(expense); integer(delay,0,60); integer(drop,0,100);
  for (const i of items) { integer(i.day_of_month,1,28); integer(i.amount_cents,1); if (!['income','expense'].includes(i.direction)) fail(400,'invalid_direction','Invalid schedule direction'); }
  for (const d of nextIncomeDelays) integer(d,1,60);
  let nextIncome=0;
  let current=balance-expense;
  const dated_balances: {date:string;balance_cents:number}[]=[{date:start,balance_cents:current}];
  // Generate original due dates, then delay income. No delayed payment is duplicated.
  const deltas = new Map<string,number>();
  for (let i=1;i<=days;i++) {
    const due=addDays(start,i);
    for (const item of items) if (Number(due.slice(-2))===item.day_of_month) {
      const eventDelay=item.direction==='income'?(nextIncomeDelays[nextIncome++]||0):0;
      let shifted=due;
      if(item.direction==='income')for(const shift of shifts)if(shift.scheduled_item_id===item.id&&shift.original_date===shifted)shifted=date(shift.delayed_date);
      const when=item.direction==='income'?addDays(shifted,Math.max(delay,eventDelay)):due;
      const delta=item.direction==='income'?Math.floor(item.amount_cents*(100-drop)/100):-item.amount_cents;
      deltas.set(when,(deltas.get(when)||0)+delta);
    }
  }
  for (let i=1;i<=days;i++) { const d=addDays(start,i); current+=deltas.get(d)||0; integer(current,-100_000_000_000); dated_balances.push({date:d,balance_cents:current}); }
  const low=dated_balances.reduce((a,b)=>a.balance_cents<=b.balance_cents?a:b);
  return calculation('forecast',{balance,start,days,items,expense,delay,drop,nextIncomeDelays,shifts},{dated_balances,low_cash_date:low.date,low_cash_cents:low.balance_cents},['UTC dates; monthly due days 1–28; scheduled payments only; checking and savings are spendable; expenses applied once at start; demo delays affect identified next income occurrences once.']);
}
export function amortize(balance: number,aprBps: number,payment: number,months=600) {
  integer(balance);integer(aprBps,0,10000);integer(payment,1);integer(months,1,600);
  let owed=BigInt(balance), interest=0n, paid=0n, count=0;
  while(owed>0n && count<months) {
    const charge=(owed*BigInt(aprBps)+60000n)/120000n; // APR basis points /12, nearest cent
    if (BigInt(payment)<=charge) return calculation('amortize',{balance,aprBps,payment,months},{payoff_months:null,interest_cents:Number(interest),remaining_cents:Number(owed),negative_amortization:true},['Monthly interest rounded half up; fixed monthly payment.']);
    const actual=BigInt(payment)<owed+charge?BigInt(payment):owed+charge;
    owed+=charge-actual; interest+=charge; paid+=actual;count++;
  }
  return calculation('amortize',{balance,aprBps,payment,months},{payoff_months:owed===0n?count:null,interest_cents:Number(interest),paid_cents:Number(paid),remaining_cents:Number(owed),negative_amortization:false},['Monthly interest rounded half up; fixed monthly payment; final payment capped at balance plus interest.']);
}
export function utilization(balance: number,limit: number|null) {
  integer(balance); if(limit!==null) integer(limit,1);
  return calculation('utilization',{balance,limit},{utilization_bps:limit===null?null:Math.round(balance*10000/limit)},['Unknown credit limit produces no utilization ratio.']);
}
export function normalize(amount: number,cadence: string) {
  integer(amount,1);const factors: Record<string,[number,number]>={monthly:[1,1],annual:[1,12],weekly:[52,12],quarterly:[1,3]};
  if(!Object.hasOwn(factors,cadence)) fail(400,'invalid_cadence','Unsupported cadence');const [n,d]=factors[cadence];return Math.round(amount*n/d);
}
export function recurring(rows: {merchant:string;posted_date:string;delta_cents:number;transfer_group?:string|null}[]) {
  const groups=new Map<string,typeof rows>();
  for(const t of rows) { integer(t.delta_cents,-100_000_000_000);date(t.posted_date);if(t.transfer_group||!t.delta_cents) continue;const key=t.merchant.trim().toLowerCase();groups.set(key,[...(groups.get(key)||[]),t]); }
  const candidates=[];
  for(const [merchant,items] of groups) {
    const sorted=items.sort((a,b)=>a.posted_date.localeCompare(b.posted_date));if(sorted.length<3) continue;
    const gaps=sorted.slice(1).map((t,i)=>(Date.parse(t.posted_date)-Date.parse(sorted[i].posted_date))/86400000);
    const typical=[...gaps].sort((a,b)=>a-b)[Math.floor(gaps.length/2)];
    const cadence=typical>=25&&typical<=35?'monthly':typical>=350&&typical<=380?'annual':typical>=6&&typical<=8?'weekly':null;
    if(!cadence||gaps.some(n=>Math.abs(n-typical)>Math.max(4,typical*.15))) continue;
    const amount=Math.abs(sorted.at(-1)!.delta_cents);
    candidates.push({merchant,cadence,amount_cents:amount,monthly_equivalent_cents:normalize(amount,cadence),price_change_cents:amount-Math.abs(sorted[0].delta_cents),status:'candidate',requires_usage_confirmation:true});
  }
  return calculation('recurring',rows,{candidates},['Candidate recurrence is not confirmed usage or permission to cancel. Transfers excluded.']);
}
export function cashFlow(rows: {kind:string;delta_cents:number;transfer_group:string|null;category:string}[]) {
  let income=0,spending=0;
  for(const r of rows) {
    if(r.transfer_group || r.category==='transfer' || r.category==='valuation') continue;
    const liability=['credit_card','auto_loan','mortgage'].includes(r.kind);
    if(liability) { if(r.delta_cents>0) spending+=r.delta_cents; else spending+=r.delta_cents; }
    else if(r.delta_cents>0) income+=r.delta_cents;else spending-=r.delta_cents;
  }
  return {income_cents:income,spending_cents:spending,savings_rate_bps:income>0?Math.round((income-spending)*10000/income):null};
}
