import type {
  Accounts,
  Forecast,
  Overview,
  Transactions,
} from "../../src/lib/finance-api";
// Synthetic response proposals for automated tests ONLY. No application fallback.
export const meta = {
  snapshot_version: 7,
  source_mode: "fixture",
  as_of: "2026-11-07T12:00:00Z",
  assumptions: ["USD only; scheduled income is assumed, not guaranteed."],
  missing_inputs: [],
} as const;
const metadata = () => ({
  ...meta,
  assumptions: [...meta.assumptions],
  missing_inputs: [],
});
export const accountsFixture: Accounts = {
  ...metadata(),
  items: [
    {
      id: "checking",
      label: "Chase checking",
      kind: "checking",
      last_four: "1000",
      balance_cents: 35000,
      last_sync_at: meta.as_of,
    },
    {
      id: "savings",
      label: "PNC savings",
      kind: "savings",
      last_four: "1001",
      balance_cents: 505000,
    },
    {
      id: "card",
      label: "Example card",
      kind: "credit_card",
      last_four: "1002",
      balance_cents: 360000,
    },
    {
      id: "investments",
      label: "Example brokerage",
      kind: "brokerage",
      balance_cents: 2140000,
    },
  ],
};
export const transactionsFixture: Transactions = {
  ...metadata(),
  items: [
    {
      id: "grocery",
      account_id: "checking",
      date: "2026-10-29",
      description: "Market Basket",
      category: "Groceries",
      amount_cents: -8420,
      classification: "charge",
      status: "posted",
    },
    {
      id: "cardcharge",
      account_id: "card",
      date: "2026-10-28",
      description: "StreamPlus",
      category: "Subscription",
      amount_cents: 1899,
      classification: "charge",
      status: "pending",
    },
    {
      id: "transfer",
      account_id: "checking",
      date: "2026-10-25",
      description: "Savings sweep",
      category: "Transfer",
      amount_cents: -15000,
      classification: "transfer",
      status: "posted",
    },
    {
      id: "payment",
      account_id: "card",
      date: "2026-10-25",
      description: "Card repayment",
      category: "Transfer",
      amount_cents: -35000,
      classification: "payment",
      status: "posted",
    },
    {
      id: "income",
      account_id: "checking",
      date: "2026-10-15",
      description: "Payroll",
      category: "Income",
      amount_cents: 260000,
      classification: "income",
      status: "posted",
    },
  ],
  next_cursor: "older-page",
};
export const olderTransactionsFixture: Transactions = {
  ...metadata(),
  items: [
    {
      ...transactionsFixture.items[0],
      id: "old",
      date: "2024-05-01",
      description: "Older history record",
    },
  ],
  next_cursor: null,
};
export const overviewFixture: Overview = {
  ...metadata(),
  liquid_cash_cents: 540000,
  debt_cents: 1760000,
  net_worth_cents: 920000,
  investments_cents: 2140000,
  indicators: [
    {
      key: "cash_buffer_months",
      value: 1.8,
      unit: "months",
      numerator_cents: 540000,
      denominator_cents: 300000,
      explanation: "Essential monthly spending basis from the backend.",
      source_mode: "fixture",
    },
    {
      key: "debt_to_income",
      value: 18,
      unit: "percent",
      numerator_cents: 90000,
      denominator_cents: 500000,
      explanation: "Monthly gross income is assumed from the schedule.",
      source_mode: "fixture",
    },
    {
      key: "card_utilization",
      value: 32,
      unit: "percent",
      numerator_cents: 360000,
      denominator_cents: 1125000,
      explanation: "Only cards with known limits are included.",
      source_mode: "fixture",
    },
  ],
  upcoming_bills: [
    {
      id: "bill",
      account_id: "checking",
      date: "2026-11-10",
      description: "Planned card payment",
      amount_cents: -125000,
      transaction_id: "payment",
    },
  ],
};
export const forecastFixture: Forecast = {
  ...metadata(),
  account_ids: ["checking"],
  balances: [
    { date: "2026-11-07", balance_cents: 35000 },
    { date: "2026-11-10", balance_cents: -90000 },
    { date: "2026-11-15", balance_cents: 170000 },
    { date: "2026-11-18", balance_cents: 163500 },
  ],
  events: [
    ...(overviewFixture.upcoming_bills ?? []),
    {
      id: "payday",
      account_id: "checking",
      date: "2026-11-15",
      description: "Expected paycheck",
      amount_cents: 260000,
    },
  ],
  low_cash_date: "2026-11-10",
  low_cash_explanation:
    "The planned card payment precedes the expected paycheck. Low cash means below zero for this checking account.",
};
