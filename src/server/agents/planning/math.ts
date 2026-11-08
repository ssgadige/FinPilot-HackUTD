export function integer(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('INVALID_PLANNING_INPUT');
  return value;
}
export function safe(value: bigint): number {
  const n = Number(value); if (!Number.isSafeInteger(n)) throw new Error('INVALID_CENTS'); return n;
}
export function sum(values: number[]): number { return safe(values.reduce((a,b) => a + BigInt(b), 0n)); }
export function validDate(value: string): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function plusDays(value: string, days: number): string {
  const d = new Date(value); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10);
}
export function plusMonths(value: string, months: number): string {
  const d = new Date(value); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth()+months);
  const last = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last)); return d.toISOString().slice(0,10);
}
export function currencyDisplays(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(currencyDisplays);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string,unknown> = {}; const display: Record<string,string> = {};
  for (const [key,item] of Object.entries(value)) {
    result[key] = currencyDisplays(item);
    if (key.endsWith('_cents') && typeof item === 'number' && Number.isSafeInteger(item)) {
      const n = BigInt(item); const abs = n < 0n ? -n : n;
      display[key] = `${n < 0n ? '-' : ''}$${abs/100n}.${String(abs%100n).padStart(2,'0')}`;
    }
  }
  if (Object.keys(display).length) result.currency_display = display;
  return result;
}
// Nominal APR/12, interest rounded half-up to integer cents before each payment.
// This is an explicit estimate, not an emulation of a lender's daily accrual.
export function simulatePayoff(balanceCents: number, aprBps: number | null, monthlyPaymentCents: number | null,
  firstExtraCents = 0, maxMonths = 360) {
  integer(balanceCents); integer(firstExtraCents); integer(maxMonths,1,360);
  if (aprBps !== null) integer(aprBps,0,10000);
  if (monthlyPaymentCents !== null) integer(monthlyPaymentCents);
  const base = { starting_balance_cents: balanceCents, apr_bps: aprBps, monthly_payment_cents: monthlyPaymentCents,
    first_extra_cents: firstExtraCents, max_months: maxMonths,
    apr_percent_display: aprBps===null?null:`${Math.floor(aprBps/100)}.${String(aprBps%100).padStart(2,'0')}%` };
  if (!balanceCents) return { ...base, status:'paid_off', payoff_months:0, total_interest_cents:0, total_paid_cents:0, ending_balance_cents:0 };
  if (aprBps === null || monthlyPaymentCents === null) return { ...base, status:'needs_information', payoff_months:null,
    total_interest_cents:null, total_paid_cents:null, ending_balance_cents:null };
  let balance = balanceCents; let interestTotal = 0; let paidTotal = 0;
  for (let month=1; month<=maxMonths; month++) {
    const interest = safe((BigInt(balance)*BigInt(aprBps)+60000n)/120000n);
    const owed = sum([balance,interest]);
    const payment = Math.min(owed,sum([monthlyPaymentCents,month===1?firstExtraCents:0]));
    balance = owed-payment; interestTotal=sum([interestTotal,interest]); paidTotal=sum([paidTotal,payment]);
    if (!balance) return { ...base, status:'paid_off', payoff_months:month, total_interest_cents:interestTotal, total_paid_cents:paidTotal, ending_balance_cents:0 };
    if (payment<=interest && (month>1 || firstExtraCents===0)) return { ...base, status:'non_amortizing', payoff_months:null,
      total_interest_cents:interestTotal,total_paid_cents:paidTotal,ending_balance_cents:balance };
  }
  return { ...base,status:'horizon_exceeded',payoff_months:null,total_interest_cents:interestTotal,total_paid_cents:paidTotal,ending_balance_cents:balance };
}
