# FP-20 — debt readiness and goal negotiation

Implements #20 on `feat/fp-20-debt-readiness-and-goal-negotiation-agents`.
`runDebt` and `runGoals` use the existing distinct role prompts, real Nemotron
adapter and bounded FP-18 runtime. No shared API/schema changes and no extra
service/framework. Request review before merging.

## Verify

```sh
node --test tests/planning.test.ts tests/agent-runtime.test.ts tests/subscriptions.test.ts tests/nemotron.test.ts
node --env-file-if-exists=.env scripts/smoke-planning.ts --record
```

The smoke uses live NVIDIA inference and an explicitly **fixture** financial
snapshot. It requires actual tool traces, a completed debt result and a fresh goal
comparison covering every returned alternative. It asserts conservation of all
starting cash and saves `acceptance.json` only after success. Failed runs exit
nonzero without replacing prior evidence; diagnostics contain safe codes and
synthetic monetary claims, never credentials or raw provider text.

## Server integration

`createPlanningTools(loadSnapshot)` exposes these read-only role tools:

| Role | Allowlist |
| --- | --- |
| debt-readiness | get_debt_summary, simulate_debt_payoff, calculate_utilization |
| goal-allocator | get_goals, allocate_budget, compare_plans |

All tools accept only `{ "scope": "snapshot" }`. Identity, account IDs, debt IDs,
goal IDs, proposed payments and allocation amounts are server-selected. Model
arguments cannot add money, change a user or execute a payment. Construct one
shared RunBudget for a checkup, and pass cancellation and safe event persistence
callbacks as in FP-18. Goal Allocator requires a completed/needs-information Debt
Readiness dependency for the exact same owner, run, version and account selection.
It receives prior analysis as untrusted context and must generate its own findings
from goal tools, not copy predecessor findings.

The `PlanningLoader` in `types.ts` is the authenticated backend connection point.
It must recheck current consent/ownership on each read, project only authorized
selected accounts and child records, and resolve accepted action versions outside
model control. Every tool clones the loaded snapshot and validates owner, version,
connected accounts, debt/payment-account ownership, goals, bill/debt joins and
cost-change/bill joins before calculation. Context is cloned and frozen by the
runtime. Duplicate IDs and multiple changes for one bill fail validation.

The loader provides explicit reconciled balances, APR basis points, minimums,
limits and dates. Checking/savings/wallet funds are liquid. Loan and credit-card
accounts must each have one debt record with matching balance/kind. Debt minimums
and bills must be due within the 30-day reservation horizon; goal deadlines are
bounded to ten years. The snapshot is capped at 30 accounts, 10 debts, 10 goals,
100 bills and 100 changes. Rejected, stale or disconnected snapshots never produce
spendable capacity.

**FP-13/14 and the production authenticated loader/routes/storage are absent in
this checkout.** These narrowly scoped deterministic calculations make the two
agents runnable against an authorized snapshot interface. They do not implement
production debt servicing, plan persistence or atomic acceptance. The backend
must map its loan account kinds and current action versions into this interface;
no direct database queries or authentication bypass were added.

## Shared budget and alternatives

Current liquid cash reserves, in order of protection:

1. Future bills at their accepted effective cost.
2. Required debt minimums, counting a linked scheduled payment only once and
   adding only any uncovered minimum. A scheduled payment above the minimum is
   still reserved and included in that first payoff period.
3. Each liquid account's explicit cash buffer.
4. Already-saved goal money held within those account balances.

Only remaining cash is discretionary. If any account has a deficit, balances are
unreconciled, or an active debt minimum is unknown, there is no discretionary
allocation. Future income, CD maturity, brokerage and IRA balances never increase
capacity. The solver does not silently transfer funds across accounts.

An accepted cost change replaces a future bill exactly once when effective by
its due date. Its old amount must match that bill. Proposed changes are ignored;
the cost reduction is never also added to cash. Realized savings stay zero.

The solver generates debt-first (highest known APR, then ID), goal-first (priority,
deadline, ID), and balanced alternatives. Balanced gives half the available cash
to debt, then goals, and reuses any leftover only within that account. Debt extras
are capped by balance less committed payments; goal contributions by target less
existing savings. Duplicate alternatives are removed. No cash or no competing
needs produces an explicit empty/smaller set, never fabricated different plans.

Every alternative proves both identities in code:

```text
extra debt + new goal contributions + unallocated = discretionary cash
bills + minimums + buffer + existing goals + discretionary cash = starting liquid cash
```

Account-level identities are checked too. These alternatives are mutually
exclusive; they cannot all be accepted or combined as one allocation. Tools return
the authoritative totals; model prose never changes them. All actions remain
confirmation-required proposals, with no purchase, transfer, payment or plan
acceptance tool.

## Payoff, utilization and dates

- APR uses basis points: 2400 means 24.00%. Interest is nominal APR/12, rounded
  half-up to cents before each month's payment, using BigInt arithmetic. Fees,
  rate changes, daily accrual and new charges are excluded explicitly.
- Minimum monthly payment stays fixed for the scenario; the discretionary extra
  is paid **once** in the first month. Existing scheduled first-period payments
  above the minimum are also honored once. Future minimum affordability is an
  assumption, not verified income or lending readiness.
- Projection is bounded to 360 months. Zero APR is valid. Missing APR/minimum,
  non-amortizing payments and horizon exhaustion yield no invented payoff date.
  Totals for unfinished projections are horizon/partial totals, not full payoff
  estimates. Calendar-month estimates clamp month-end dates.
- Utilization uses only credit cards with explicit nonzero limits; loans are
  excluded. A missing/zero card limit makes aggregate utilization unknown rather
  than silently calculating a partial ratio. Missing APR/minimum/limit is returned
  in missing_data and forces a needs_information agent result.
- Goal remaining-monthly requirements are rounded-up calculations from remaining
  target and calendar months to deadline. They do not assume repeating today's
  surplus. Unfunded goals have no promised completion date. A fully funded goal's
  date is conditional on accepting the proposal now.
- No credit score, score-point gain, qualification or approval is calculated.
  Obvious numerical score/affirmative approval claims are rejected by result
  validation. This narrow check is not a complete semantic prose verifier;
  the broader evidence gate remains FP-23's responsibility.

All results retain fixture/live/cached financial evidence labels. Deterministic
dollar displays and runtime currency checks prevent cent-to-dollar errors.
The documented Super 3.5 reasoning preset is shared with FP-19 for these new roles;
other model IDs receive no unsupported protocol override. Existing call/time/tool
budgets and the one-repair limit still apply.

## Fixture scenario

$5,000 in checking; $1,215 bills after an accepted $5 reduction; $100 card minimum;
$1,000 buffer; $500 earmarked goal savings. Discretionary cash is **$2,185**. The
$9,000 CD and proposed rent reduction are excluded. The $3,000 card has a 24% APR
and $6,000 limit (50% utilization).

| Alternative | Extra debt | New goal contribution | Starting cash accounted |
| --- | ---: | ---: | ---: |
| debt_first | $2,185.00 | $0.00 | $5,000.00 |
| goal_first | $0.00 | $2,185.00 | $5,000.00 |
| balanced | $1,092.50 | $1,092.50 | $5,000.00 |

All figures describe a synthetic scenario, not actual financial recommendations.

## Recorded acceptance

`acceptance.json` records the real NVIDIA test: eight inference calls, six tools,
31.090 seconds, and all three mutually exclusive alternatives. The combined Node
test suite passes 55 tests. Financial data is fixture, inference is live, and no
score/approval, payment or realized savings is claimed. Review the exact source
labels and conditional assumptions in the artifact before interpreting results.
