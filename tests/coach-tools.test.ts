import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseAffordability, monthlyPayment } from '../src/server/tools/finance/affordability.ts';
import { chat } from '../src/server/agents/chat/index.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { statedNumbers, type CoachQueries } from '../src/server/agents/chat/coach-tools.ts';
import type { complete, Message } from '../src/server/nemotron/index.ts';
import type { ToolContext } from '../contracts/types.ts';

const config = { apiKey: 'test-secret', baseUrl: 'https://example.test', model: 'nvidia/nemotron', timeoutMs: 30000 };
const context: ToolContext = { userId: 'user-a', runId: 'run-1', snapshotVersion: 3, allowedAccountIds: ['checking'] };
const profile = { liquid_cash_cents: 8_000_000, monthly_income_cents: 520_000, monthly_spending_cents: 300_000, essential_monthly_cents: 400_000, monthly_debt_payments_cents: 100_000 };

test('monthly payment matches the standard amortization formula', () => {
  assert.equal(monthlyPayment(1_800_000, 700, 60), 35_642); // $18,000 at 7% for 60 months = $356.42
  assert.equal(monthlyPayment(1_200_000, 0, 12), 100_000);
  assert.equal(monthlyPayment(0, 700, 60), 0);
});

test('affordability verdicts follow the stated rules and report defaults', () => {
  const ok = purchaseAffordability({ price_cents: 2_000_000, down_payment_cents: null, apr_bps: null, term_months: null, ...profile });
  assert.equal(ok.verdict, 'comfortable');
  assert.deepEqual(ok.defaults_used, ['down_payment_10_percent', 'apr_7_percent', 'term_60_months']);
  assert.equal(ok.down_payment_cents, 200_000); assert.equal(ok.loan_amount_cents, 1_800_000);
  assert.equal(ok.cash_after_down_payment_cents, 7_800_000);

  const big = purchaseAffordability({ price_cents: 9_000_000, down_payment_cents: 500_000, apr_bps: 700, term_months: 36, ...profile });
  assert.equal(big.verdict, 'not_affordable_now');
  assert.ok(big.reasons.includes('payment_exceeds_monthly_net_savings'));

  const cash = purchaseAffordability({ price_cents: 9_000_000, down_payment_cents: 9_000_000, apr_bps: 700, term_months: 1, ...profile });
  assert.equal(cash.verdict, 'not_affordable_now'); assert.ok(cash.reasons.includes('down_payment_exceeds_liquid_cash'));
  assert.equal(cash.monthly_payment_cents, 0);

  const noIncome = purchaseAffordability({ price_cents: 100_000, down_payment_cents: 0, apr_bps: 0, term_months: 10, ...profile, monthly_income_cents: 0, monthly_spending_cents: 0 });
  assert.equal(noIncome.payment_to_income_bps, null); assert.ok(noIncome.missing_data.length > 0);

  assert.throws(() => purchaseAffordability({ price_cents: -5, down_payment_cents: null, apr_bps: null, term_months: null, ...profile }));
});

function queries(calls: string[]): CoachQueries {
  const affordability = (uid: string, args: Record<string, unknown>) => {
    calls.push(`affordability:${uid}`);
    return purchaseAffordability({ price_cents: (args.price_dollars as number) * 100, down_payment_cents: null, apr_bps: null, term_months: null, ...profile });
  };
  const unused = () => { throw new Error('not used in this test'); };
  return { accounts: unused, cashFlow: unused, spendingByCategory: unused, merchantSpending: unused, upcomingBills: unused,
    subscriptions: async () => unused(), debts: unused, goals: unused, affordability, expenseImpact: unused };
}
const load = async () => ({ context, overview: { liquid_cash_cents: 8_000_000 }, findings: [], plan: null });
/** Calls one chosen tool, then answers quoting a currency_display value from that tool. */
function model(tool: string, args: Record<string, unknown>, quote: (data: { currency_display: Record<string, string> }) => string): typeof complete {
  return async (_c, messages: Message[], available) => {
    const toolMsgs = messages.filter(m => m.role === 'tool');
    if (available?.length && !toolMsgs.length) return { latencyMs: 1, message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: tool, arguments: JSON.stringify(args) } }] } };
    const out = JSON.parse(toolMsgs[0].content!);
    return { latencyMs: 1, message: { role: 'assistant', content: JSON.stringify({ agent_id: 'chat', status: 'completed', headline: quote(out.data), findings: [],
      evidence_ids: out.evidence.map((e: { id: string }) => e.id), assumptions: [], missing_data: [], proposed_actions: [], snapshot_version: context.snapshotVersion }) } };
  };
}

test('coach answers a car question from the affordability tool without calling every tool', async () => {
  const calls: string[] = [];
  const r = await chat({ context, message: 'Can I afford a $20,000 car?', config, budget: new RunBudget(), load, queries: queries(calls),
    infer: model('check_purchase_affordability', { price_dollars: 20000 }, d => `Yes. A $20,000.00 car would cost about ${d.currency_display.monthly_payment_cents} a month.`) });
  assert.equal(r.result.result.status, 'completed');
  assert.match(r.reply, /\$356\.42 a month/);
  assert.deepEqual(calls, ['affordability:user-a']);
  assert.deepEqual(r.result.trace.map(t => t.tool), ['check_purchase_affordability']);
});

test('coach still rejects dollar amounts that no tool returned', async () => {
  const r = await chat({ context, message: 'Can I afford a $20,000 car?', config, budget: new RunBudget(), load, queries: queries([]),
    infer: model('check_purchase_affordability', { price_dollars: 20000 }, () => 'Your payment would be $123.45 a month.') });
  assert.equal(r.result.result.status, 'failed');
});

test('coach tools reject bad arguments and never use another user', async () => {
  const bad = await chat({ context, message: 'Can I afford it?', config, budget: new RunBudget(), load, queries: queries([]),
    infer: model('check_purchase_affordability', { price_dollars: 20000, user_id: 'user-b' }, () => 'x') });
  assert.equal(bad.result.result.status, 'failed');
  const foreign = await chat({ context, message: 'Can I afford a car?', config, budget: new RunBudget(), queries: queries([]),
    load: async () => ({ ...await load(), context: { ...context, userId: 'user-b' } }),
    infer: model('check_purchase_affordability', { price_dollars: 20000 }, () => 'x') });
  assert.equal(foreign.result.result.status, 'failed');
});

test('stated numbers are parsed from what the user typed', () => {
  const n = statedNumbers('Can I afford a $20,000 car with 5k down at 6.5% over 48 months?');
  for (const v of [20000, 5000, 6.5, 48]) assert.ok(n.has(v), String(v));
  assert.ok(!n.has(25000));
});

test('the model cannot invent a purchase price the user never gave', async () => {
  const calls: string[] = [];
  const r = await chat({ context, message: 'Can I afford a car?', config, budget: new RunBudget(), load, queries: queries(calls),
    infer: async (_c, messages, available) => {
      const toolMsgs = messages.filter(m => m.role === 'tool');
      if (available?.length && !toolMsgs.length) return { latencyMs: 1, message: { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'check_purchase_affordability', arguments: '{"price_dollars":25000}' } }] } };
      const out = JSON.parse(toolMsgs[0].content!);
      assert.equal(out.data.needs_user_input, true);
      return { latencyMs: 1, message: { role: 'assistant', content: JSON.stringify({ agent_id: 'chat', status: 'needs_information', headline: 'What is the price of the car you are considering?', findings: [],
        evidence_ids: out.evidence.map((e: { id: string }) => e.id), assumptions: [], missing_data: ['Purchase price'], proposed_actions: [], snapshot_version: context.snapshotVersion }) } };
    } });
  assert.equal(r.result.result.status, 'needs_information');
  assert.deepEqual(calls, []); // the affordability calculation never ran on an invented price
});
