# FP-21 — Stress-test specialist and comparisons

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 1.5 hours |
| Dependencies | FP-20; FP-13 |
| Priority | P0 |

## Scope
Run fixed delayed-income, surprise-expense and reduced-income scenarios on candidate plans; compare first shortfall, minimum balance and goal changes.

## Implementation area
src/server/agents/stress

## Acceptance criteria
- [x] Baseline preserved.
- [x] Deterministic calculations and explicit assumptions.
- [x] Result identifies failure date or no failure within tested horizon.
- [x] No probability claim.

## Acceptance evidence

The live Debt Readiness → Goal Allocator → Stress-Test chain passed with one
shared context/budget: 12 model calls, 9 actual tool executions (3 stress tools),
31.941 seconds. Financial records are explicitly fixture; inference is live.

Baseline and candidate allocations remain unchanged. Delayed/reduced income cause
no failure within the tested 30-day horizon. The independent $3,000 surprise
expense produces a debt-first cash shortfall of -$500 on 2026-11-20. Goal-first
and balanced breach their protected buffers on 2026-11-14 without negative cash.
The model reports those separate dates and explicit changes to required goal
funding without inventing a new completion date or probability.

- [Actual live results, evidence, tool trace and comparisons](../../../src/server/agents/stress/acceptance.json)
- [Scenario assumptions, verification commands and integration boundary](../../../src/server/agents/stress/README.md)
- `node --test tests/stress.test.ts tests/planning.test.ts tests/agent-runtime.test.ts tests/subscriptions.test.ts tests/nemotron.test.ts`:
  **69 tests passed**, including baseline/input immutability, independent scenarios,
  exact failure dates, deadline checks, same-day ordering, income beyond horizon,
  whole-cent reductions, multi-account/multi-goal funding, scoped access,
  disconnected records, strict arguments and probability/guarantee rejection.

The production authenticated loader/routes/storage and the broader FP-13 library
remain separate integration work. This task adds a scoped StressLoader interface;
no real payments, automatic goal/plan edits or production database integration
are claimed.

## Pull request requirements
- Branch: `feat/fp-21-stress-test-specialist-and-comparisons`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #21](https://github.com/ssgadige/FinPilot-HackUTD/issues/21)
