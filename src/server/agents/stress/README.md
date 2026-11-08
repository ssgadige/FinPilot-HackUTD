# FP-21 — deterministic stress-test specialist

Implements #21 on `feat/fp-21-stress-test-specialist-and-comparisons`.
The new `runStress` wrapper uses the distinct stress-test prompt and the existing
bounded Nemotron runtime. No shared API/schema changes or additional services.

## Verification

```sh
node --test tests/stress.test.ts tests/planning.test.ts tests/agent-runtime.test.ts tests/subscriptions.test.ts tests/nemotron.test.ts
node --env-file-if-exists=.env scripts/smoke-stress.ts --record
```

The live smoke runs Debt Readiness → Goal Allocator → Stress-Test with one shared
call budget and exactly the same server owner/run/version/account context. NVIDIA
inference is real; all financial records are explicitly **fixture**. It requires
all three stress tool executions, all three scenario IDs and the actual fixture
failure dates in the agent response. `--record` writes `acceptance.json` only on
success. Failed verification never overwrites prior evidence. No raw provider
errors, prompts, credentials or hidden reasoning are logged.

## Authorized input and tools

Use a server-owned `StressLoader` returning a `PlanningSnapshot` plus bounded,
scoped future income rows. Every read rechecks the full FP-20 ownership/version/
selected-account/consent rules, and ownership of each income child row. Receipt
IDs are unique, amounts are positive integer cents and dates are strictly after
the snapshot date and within the 30-day horizon. At most 100 receipts are accepted.
Only explicitly confirmed scheduled receipts are included. They remain assumptions
about future cash, not guaranteed income.

| Tool | Result |
| --- | --- |
| forecast_cash | Each candidate's independent baseline forecast |
| stress_test_plan | Baseline plus fixed independent shocks and goal effects |
| compare_plans | Side-by-side changes and scenario-level summaries |

All tools accept only `{ "scope": "snapshot" }`. No client/model-selected user,
account, plan, amount, horizon or scenario parameters. Candidate allocations are
regenerated from the same scoped FP-20 solver, never supplied by the model. The
stress registry is role-specific: its `forecast_cash` and `compare_plans` implement
stress behavior, rather than the other roles' similarly named tools. Do not merge
registries by tool name and accidentally overwrite role implementations.

Stress-Test requires a completed/needs-information Goal Allocator dependency for
the same authenticated context. Prior findings are untrusted input context; the
agent must generate fresh stress findings from its own tools. Missing candidate
plans or unresolved planning data forces needs_information instead of a false
successful check. The original source, baseline and candidate allocations are
never modified, and scenarios start from fresh balances independently.

## Fixed scenario assumptions

The horizon includes the snapshot day through 30 days after it. The baseline
applies accepted effective bills, uncovered debt minimums and each candidate's
one-time extra debt payment on its scheduled debt due date. It reuses FP-20's
single reservation/obligation implementation, so minimums and confirmed cost
changes are not counted twice. Existing and proposed goal contributions are
reserved immediately; goal contributions stay in the bank as earmarked funds.
Nonliquid assets and implicit cross-account transfers remain excluded.

| Scenario | Fixed change |
| --- | --- |
| delayed_income | Move every confirmed future receipt seven days later; receipts beyond the horizon are omitted |
| surprise_expense | Add a $3,000 expense seven days after the snapshot to the first liquid account sorted by ID |
| reduced_income | Reduce each confirmed receipt by 25%; remaining income rounds down to integer cents |

These are independent hypothetical shocks, not distributions, event likelihoods
or predictions. Scenario parameters are chosen by server code and are displayed
explicitly. There is no random sampling, probability score or promise of resilience.
Expenses are processed before receipts on the same date; a later same-day deposit
can recover closing cash without erasing the earlier shortfall. Past receipts are
rejected rather than applied again. Missing/unconfirmed income never becomes an
invented paycheck.

## Failure dates, minimums and goals

The forecast tracks each liquid account and the total cash at every event, using
checked integer-cent arithmetic. Global minimum is calculated from the simultaneous
balances, not by adding unrelated account minima. A positive combined cash balance
does not rescue a negative paying account.

Distinct failures are reported:

- **Cash shortfall:** actual account cash becomes negative.
- **Buffer breach:** cash minus existing/new goal earmarks falls below that
  account's required buffer, even if actual cash is still positive.
- **Goal funding breach:** cash cannot cover the earmarked goal amounts.
- **Deadline miss:** the goal cannot be fully covered after preserving the buffer
  at the end of its deadline date, when that date is inside the tested horizon.

The result includes the first constraint failure date and each specific cash/buffer/
goal date. No failure means **no failure within the tested horizon**, never
indefinite safety. Minima include the opening state and intra-day event order.

Goal coverage is checked per account after preserving its buffer, with existing
savings covered first and new contributions next in priority order. The same funds
cannot cover two goals. Reported additional funding and existing earmarks at risk
are hypothetical consequences, not mutations or actual withdrawals. Unknown future
contribution capacity means no invented deadline extension/completion date. Full
internal calculations are deterministic; model-facing summaries show all failing
accounts and the lowest-cash account, with tested/omitted account counts. Unchanged
goal rows are omitted to bound response size.

The agent receives deterministic dollar displays and existing currency/evidence
checks. Numeric probability, likelihood and guarantee claims are rejected with one
bounded output repair. The 25% income reduction is a shock size, not a probability.
This targeted guard is not a complete semantic verifier; FP-23 still owns the
broader evidence gate. Existing inference/tool/time/cancellation budgets apply.

## Fixture outcome

All three baseline candidates preserve their protected funds. Delayed and reduced
income cause no failure within the tested horizon. The surprise expense causes:

| Candidate | First constraint failure | First actual cash shortfall | Minimum total cash |
| --- | --- | --- | ---: |
| debt_first | 2026-11-20 | 2026-11-20 | -$500.00 |
| goal_first | 2026-11-14 | None within horizon | $1,685.00 |
| balanced | 2026-11-14 | None within horizon | $592.50 |

These dates and amounts come from the tools. Goal funding requirements change, but
no goal deadline or accepted plan is automatically changed.

## Integration boundary

FP-13 and the production authenticated data loader/routes/storage are absent in
this checkout. Implement the `StressLoader` with scoped queries and snapshot/
consent checks; persist returned events/evidence/results through run orchestration.
No direct database access, real payments, automatic plan edits or deployment has
been added. Review the source labels and assumptions before interpreting results.
Request review before merging this task branch into main.

## Recorded acceptance

The saved real NVIDIA chain completed in 31.941 seconds with twelve model calls
and nine actual tools, including all three stress tools. It reports both fixture
failure dates and explicit car-goal funding changes without new deadline guesses
or probabilities. The combined Node suite passes 69 tests. See `acceptance.json`
for exact results, source labels, timings, dependency traces and comparisons.
