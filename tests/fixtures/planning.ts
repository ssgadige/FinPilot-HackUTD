import { accountsFixture, meta } from "./finance";
export const planningAccounts = {
  ...accountsFixture,
  items: [
    ...accountsFixture.items,
    {
      id: "cd",
      label: "Example CD",
      kind: "cd",
      last_four: "1004",
      balance_cents: 740000,
      maturity_date: "2027-04-01",
    },
  ],
};
export const subscriptionRows = {
  items: [
    {
      id: "subscription-1",
      account_id: "card",
      merchant: "StreamPlus",
      cadence: "monthly",
      amount_cents: 1899,
      status: "candidate",
      usage_confirmed: null,
      preferences_json: "{}",
    },
  ],
};
export const goalRows = {
  items: [
    {
      id: "goal-1",
      title: "Emergency cushion",
      target_cents: 600000,
      saved_cents: 300000,
      deadline: "2027-06-01",
      priority: 1,
      version: 1,
    },
  ],
};
export const debtRows = {
  items: [
    {
      id: "card",
      balance_cents: 360000,
      apr_bps: 2499,
      minimum_payment_cents: 10000,
      credit_limit_cents: 1125000,
      utilization_bps: 3200,
    },
  ],
};
export const offersRows = {
  items: [
    {
      id: "sample-annual",
      provider: "Example provider",
      plan: "Annual same-feature sample",
      source_url: null,
      source_mode: "fixture",
      verified_at: "2026-11-07T12:00:00Z",
      monthly_equivalent_cents: 1583,
      upfront_cents: 18996,
      eligibility: ["Confirm eligibility with the provider"],
      features: ["Same-feature sample only"],
      promo_end: null,
      renewal_cents: 21996,
      currency: "USD",
    },
  ],
};
export const planRows = {
  items: [
    {
      id: "plan-1",
      version: 2,
      status: "proposed",
      snapshot_version: meta.snapshot_version,
      stale: false,
      payload: {
        allocations: [
          {
            kind: "goal_contribution",
            target_id: "goal-1",
            monthly_cents: 100000,
            day_of_month: 15,
          },
        ],
        reserve_cents: 100000,
        evidence_ids: ["evidence-1"],
        assumptions: [
          "Bills and minimums are reserved once; allocations are proposals.",
        ],
      },
    },
  ],
};
export const scenarioResult = {
  source_mode: "fixture",
  snapshot_version: meta.snapshot_version,
  assumptions: ["Projected cash; scheduled income assumed."],
  dated_balances: [
    { date: "2026-11-07", balance_cents: 35000 },
    { date: "2026-11-10", balance_cents: -90000 },
  ],
  low_cash_date: "2026-11-10",
  low_cash_cents: -90000,
  reserve_cents: 100000,
  reserve_breached: true,
  evidence_ids: ["evidence-1"],
};
export const runFixture = {
  id: "run-1",
  status: "completed",
  snapshot_version: meta.snapshot_version,
  model_status: "test fixture response · not live inference",
  steps: [
    {
      agent_id: "data-integrity",
      status: "completed",
      result: {
        agent_id: "data-integrity",
        status: "completed",
        headline: "Review the scoped evidence.",
        findings: [
          {
            id: "finding-1",
            severity: "warning",
            summary: "A stale balance needs review.",
            evidence_ids: ["evidence-1"],
            amount_cents: null,
          },
        ],
        evidence_ids: ["evidence-1"],
        assumptions: ["Snapshot supplied by automated test."],
        missing_data: [],
        proposed_actions: [],
        snapshot_version: meta.snapshot_version,
      },
    },
  ],
};
