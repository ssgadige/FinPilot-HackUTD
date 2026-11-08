import Decimal from 'decimal.js';

// Deterministic purchase affordability. All money is integer cents; rates are basis points.
// The model never does this arithmetic: it only explains these returned values.

export const AFFORDABILITY_DEFAULTS = { down_payment_bps: 1000, apr_bps: 700, term_months: 60 } as const;
// Widely used consumer-finance rules of thumb, stated explicitly as assumptions.
export const AFFORDABILITY_RULES = {
  min_buffer_months: 3,          // emergency cash left after the down payment
  comfortable_buffer_months: 6,
  max_payment_to_income_bps: 1500, // new payment above 15% of income is a stretch
  max_dti_bps: 3600,             // total debt payments above 36% of income is a stretch
  hard_dti_bps: 4300,            // above 43% is not affordable now
} as const;

export interface AffordabilityInput {
  price_cents: number;
  down_payment_cents: number | null;
  apr_bps: number | null;
  term_months: number | null;
  liquid_cash_cents: number;
  monthly_income_cents: number;
  monthly_spending_cents: number;
  essential_monthly_cents: number;
  monthly_debt_payments_cents: number;
}

function cents(n: number, min = 0, max = 100_000_000_000) {
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('INVALID_TOOL_ARGUMENTS');
  return n;
}

export function monthlyPayment(principalCents: number, aprBps: number, termMonths: number): number {
  cents(principalCents); cents(aprBps, 0, 10_000); cents(termMonths, 1, 120);
  if (principalCents === 0) return 0;
  if (aprBps === 0) return Math.ceil(principalCents / termMonths);
  const r = new Decimal(aprBps).div(120_000); // APR bps -> monthly rate
  const factor = r.plus(1).pow(termMonths);
  return new Decimal(principalCents).mul(r).mul(factor).div(factor.minus(1)).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function purchaseAffordability(input: AffordabilityInput) {
  const price = cents(input.price_cents, 1);
  const defaultsUsed: string[] = [];
  let down = input.down_payment_cents;
  if (down === null) { down = Math.round(price * AFFORDABILITY_DEFAULTS.down_payment_bps / 10_000); defaultsUsed.push('down_payment_10_percent'); }
  cents(down);
  if (down > price) down = price;
  let apr = input.apr_bps;
  if (apr === null) { apr = AFFORDABILITY_DEFAULTS.apr_bps; defaultsUsed.push('apr_7_percent'); }
  let term = input.term_months;
  if (term === null) { term = AFFORDABILITY_DEFAULTS.term_months; defaultsUsed.push('term_60_months'); }
  cents(apr, 0, 10_000); cents(term, 1, 120);
  const liquid = cents(input.liquid_cash_cents, -100_000_000_000);
  const income = cents(input.monthly_income_cents);
  const spending = cents(input.monthly_spending_cents, -100_000_000_000);
  const essential = cents(input.essential_monthly_cents);
  const debtPayments = cents(input.monthly_debt_payments_cents);

  const loan = price - down;
  const payment = monthlyPayment(loan, apr, term);
  const totalPaid = loan === 0 ? 0 : payment * term;
  const interest = Math.max(0, totalPaid - loan);
  const cashAfter = liquid - down;
  const netSavings = income - spending;
  const netAfter = netSavings - payment;
  const bufferAfter = essential > 0 ? Math.floor(cashAfter * 10 / essential) / 10 : null;
  const paymentToIncome = income > 0 ? Math.round(payment * 10_000 / income) : null;
  const dtiAfter = income > 0 ? Math.round((debtPayments + payment) * 10_000 / income) : null;

  const reasons: string[] = []; const missing: string[] = [];
  if (income <= 0) missing.push('No linked monthly income was found, so payment ratios cannot be calculated.');
  if (essential <= 0) missing.push('No essential monthly expenses are scheduled, so the cash buffer cannot be calculated.');
  const R = AFFORDABILITY_RULES;
  let verdict: 'comfortable' | 'stretch' | 'not_affordable_now' | 'needs_information' = 'comfortable';
  if (down > liquid) { verdict = 'not_affordable_now'; reasons.push('down_payment_exceeds_liquid_cash'); }
  if (netAfter < 0) { verdict = 'not_affordable_now'; reasons.push('payment_exceeds_monthly_net_savings'); }
  if (bufferAfter !== null && bufferAfter < R.min_buffer_months) { verdict = 'not_affordable_now'; reasons.push('buffer_below_3_months_after_purchase'); }
  if (dtiAfter !== null && dtiAfter > R.hard_dti_bps) { verdict = 'not_affordable_now'; reasons.push('debt_to_income_above_43_percent'); }
  if (verdict === 'comfortable') {
    if (paymentToIncome !== null && paymentToIncome > R.max_payment_to_income_bps) { verdict = 'stretch'; reasons.push('payment_above_15_percent_of_income'); }
    if (bufferAfter !== null && bufferAfter < R.comfortable_buffer_months) { verdict = 'stretch'; reasons.push('buffer_below_6_months_after_purchase'); }
    if (dtiAfter !== null && dtiAfter > R.max_dti_bps) { verdict = 'stretch'; reasons.push('debt_to_income_above_36_percent'); }
    if (netAfter >= 0 && netSavings > 0 && payment * 2 > netSavings) { verdict = 'stretch'; reasons.push('payment_uses_over_half_of_monthly_net_savings'); }
  }
  if (missing.length && verdict === 'comfortable') verdict = 'needs_information';

  return {
    verdict, reasons, defaults_used: defaultsUsed, missing_data: missing,
    price_cents: price, down_payment_cents: down, loan_amount_cents: loan, apr_bps: apr, term_months: term,
    monthly_payment_cents: payment, total_interest_cents: interest, total_cost_cents: down + totalPaid,
    liquid_cash_cents: liquid, cash_after_down_payment_cents: cashAfter,
    monthly_income_cents: income, monthly_spending_cents: spending,
    monthly_net_savings_cents: netSavings, net_savings_after_payment_cents: netAfter,
    essential_monthly_cents: essential, buffer_months_after_purchase: bufferAfter,
    payment_to_income_bps: paymentToIncome, debt_to_income_after_bps: dtiAfter,
    rules: R,
    assumptions: [
      'Income and spending are averages of the last 3 full months of linked accounts; transfers are excluded.',
      'Payment uses a fixed-rate amortized loan; taxes, fees, insurance and fuel are not included.',
      ...(defaultsUsed.length ? [`Defaults used where you gave no value: ${defaultsUsed.join(', ')}.`] : []),
      'This is a cash-flow estimate, not a lending decision or credit-score prediction.',
    ],
  };
}
