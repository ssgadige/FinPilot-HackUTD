import type { BoundTool, Context } from '../runtime/tools.ts';
import { scopedTool } from '../evidence/index.ts';

/** Read-only, user-scoped queries supplied by the server (see src/server/coach-data.ts). */
export interface CoachQueries {
  accounts(uid: string): unknown;
  cashFlow(uid: string, months: unknown): unknown;
  spendingByCategory(uid: string, months: unknown): unknown;
  merchantSpending(uid: string, merchant: unknown, months: unknown): unknown;
  upcomingBills(uid: string, days: unknown): unknown;
  subscriptions(uid: string): Promise<unknown>;
  debts(uid: string, extraMonthlyCents: unknown): unknown;
  goals(uid: string): unknown;
  affordability(uid: string, args: Record<string, unknown>): unknown;
  expenseImpact(uid: string, amountDollars: unknown): unknown;
}

export const COACH_TOOL_NAMES = ['get_accounts', 'get_cash_flow', 'get_spending_by_category', 'get_merchant_spending', 'get_upcoming_bills',
  'get_subscriptions', 'get_debts', 'get_goals', 'check_purchase_affordability', 'simulate_expense'] as const;

const int = (description: string) => ({ type: ['integer', 'null'], minimum: 0, description });
// The model sometimes adds scope="snapshot" to every call; accept it, reject anything else.
const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties: { ...properties, scope: { type: 'string', enum: ['snapshot'] } }, required, additionalProperties: false });

/** Numbers the user actually typed, e.g. "$20,000", "20k", "6.5%", "48 months" -> 20000, 20000, 6.5, 48. */
export function statedNumbers(text: string): Set<number> {
  const out = new Set<number>();
  for (const m of text.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?(?![\d])/g)) {
    const base = Number(m[1].replaceAll(',', '')); if (!Number.isFinite(base)) continue;
    out.add(base); if (m[2]) out.add(base * (m[2].toLowerCase() === 'k' ? 1_000 : 1_000_000));
  }
  return out;
}

/**
 * Each tool re-authorizes through `authorize` (session + current consent) before
 * reading, and always queries the server-built context's user, never a model value.
 * Money and loan inputs must be numbers the user stated (`userText`); the model may
 * not invent a price. A missing price returns needs_information so the coach asks.
 */
export function coachTools(queries: CoachQueries, owner: string, authorize: () => Promise<unknown>, userText = ''): Record<string, BoundTool> {
  const stated = statedNumbers(userText);
  const said = (v: unknown) => typeof v === 'number' && stated.has(v);
  const needs = (data: unknown) => !!data && typeof data === 'object' && (data as { needs_user_input?: boolean }).needs_user_input === true;
  const run = <T>(work: (uid: string, args: Record<string, unknown>) => T) => async (args: Record<string, unknown>, ctx: Context) => {
    if (ctx.userId !== owner) throw new Error('CHAT_OWNER');
    await authorize();
    return work(ctx.userId, args);
  };
  return {
    get_accounts: scopedTool('get_accounts', run(uid => queries.accounts(uid)),
      { description: 'List linked accounts with balances, APRs, credit limits and CD maturity.' }),
    get_cash_flow: scopedTool('get_cash_flow', run((uid, a) => queries.cashFlow(uid, a.months)),
      { description: 'Monthly income, spending, net savings (how much the user saves) and debt payments for recent full months, with averages.',
        parameters: object({ months: int('Number of recent full months, 1-12. Default 3.') }) }),
    get_spending_by_category: scopedTool('get_spending_by_category', run((uid, a) => queries.spendingByCategory(uid, a.months)),
      { description: 'Spending totals by category (dining, groceries, shopping, transport...) and top merchants.',
        parameters: object({ months: int('Number of recent full months, 1-12. Default 1 (last month).') }) }),
    get_merchant_spending: scopedTool('get_merchant_spending', run((uid, a) => queries.merchantSpending(uid, a.merchant, a.months)),
      { description: 'How much the user spent at a merchant (name search), per month and in total.',
        parameters: object({ merchant: { type: 'string', description: 'Merchant name to search, e.g. Starbucks.' }, months: int('Recent full months, 1-12. Default 12.') }, ['merchant']) }),
    get_upcoming_bills: scopedTool('get_upcoming_bills', run((uid, a) => queries.upcomingBills(uid, a.days)),
      { description: 'Scheduled upcoming bills and the projected lowest cash balance and date.',
        parameters: object({ days: int('Days ahead, 1-90. Default 30.') }) }),
    get_subscriptions: scopedTool('get_subscriptions', run(uid => queries.subscriptions(uid)),
      { description: 'Detected subscriptions and recurring charges with monthly equivalents and price increases.' }),
    get_debts: scopedTool('get_debts', run((uid, a) => queries.debts(uid, said(a.extra_monthly_payment_dollars) ? (a.extra_monthly_payment_dollars as number) * 100 : null)),
      { description: 'Debts (credit cards, loans, mortgage) with APR, minimum payment, utilization and payoff time at the minimum; optionally with an extra monthly payment.',
        parameters: object({ extra_monthly_payment_dollars: int('Optional extra payment per month in whole US dollars.') }) }),
    get_goals: scopedTool('get_goals', run(uid => queries.goals(uid)),
      { description: 'Savings goals with progress, amount remaining, deadline and required monthly saving.' }),
    check_purchase_affordability: scopedTool('check_purchase_affordability', run((uid, a) => {
      if (!said(a.price_dollars)) return { needs_user_input: true, missing: 'The user has not stated a purchase price. Ask for the price; do not assume one.' };
      return queries.affordability(uid, { ...a, down_payment_dollars: said(a.down_payment_dollars) ? a.down_payment_dollars : null,
        apr_percent: said(a.apr_percent) ? a.apr_percent : null, term_months: said(a.term_months) ? a.term_months : null });
    }), { needsInformation: needs,
      description: 'Can the user afford a purchase (car, house down payment, laptop...)? Calculates loan, monthly payment, cash left, buffer and a verdict from the user\'s real finances. Pass amounts in WHOLE US DOLLARS (20000 means $20,000).',
        parameters: object({
          price_dollars: { type: 'integer', minimum: 1, description: 'Purchase price in whole US dollars.' },
          down_payment_dollars: int('Down payment in whole US dollars. Omit to assume 10%.'),
          apr_percent: { type: ['number', 'null'], minimum: 0, description: 'Loan APR in percent, e.g. 6.5. Omit to assume 7%.' },
          term_months: int('Loan length in months, 1-120. Omit to assume 60. Use 1 with full down payment for cash purchases.'),
          item: { type: ['string', 'null'], description: 'Short name of the item, e.g. car.' },
        }, ['price_dollars']) }),
    simulate_expense: scopedTool('simulate_expense', run((uid, a) => said(a.amount_dollars) ? queries.expenseImpact(uid, a.amount_dollars)
      : { needs_user_input: true, missing: 'The user has not stated an expense amount. Ask for it; do not assume one.' }),
      { needsInformation: needs, description: 'What happens to cash and the emergency buffer if the user pays a one-time expense today.',
        parameters: object({ amount_dollars: { type: 'integer', minimum: 1, description: 'Expense in whole US dollars.' } }, ['amount_dollars']) }),
  };
}
