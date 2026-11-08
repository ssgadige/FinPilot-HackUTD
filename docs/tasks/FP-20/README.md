# FP-20 — Debt readiness and goal negotiation agents

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 2 hours |
| Dependencies | FP-18; FP-13/14 |
| Priority | P0 |

## Scope
Wire payoff/utilization tools and shared budget constraints. Generate competing goal/debt allocations with reserved bills/buffer and only confirmed cost changes.

## Implementation area
src/server/agents/debt, goals

## Acceptance criteria
- [x] Distinct alternatives with calculated totals.
- [x] Same money not allocated twice.
- [x] No invented credit score or approval.
- [x] Missing APR/limit flagged.

## Acceptance evidence

Live Nemotron verification passed with labeled fixture finances: eight model
calls, six actual agent tools, 31.090 seconds total. Debt Readiness returned
tool-supported utilization and conditional payoff comparisons. Goal Allocator
consumed that result and returned separate debt_first, goal_first and balanced
findings, preserving all reservations.

All alternatives account for the same $5,000 starting cash. After reserving bills,
minimums, buffer and existing goal savings, $2,185 remains. Debt-first assigns it
to extra debt; goal-first assigns it to the goal; balanced splits it $1,092.50 each.
Only the accepted $5 future bill reduction is counted, once; proposed changes and
the $9,000 CD do not increase available cash. Realized savings remain zero.

- [Recorded live results, actual tool trace and calculated alternatives](../../../src/server/agents/planning/acceptance.json)
- [Calculation assumptions, reproduction commands and integration boundary](../../../src/server/agents/planning/README.md)
- `node --test tests/planning.test.ts tests/agent-runtime.test.ts tests/subscriptions.test.ts tests/nemotron.test.ts`:
  **55 tests passed**, including known amortization, zero/missing APR, missing limit,
  minimum-payment deduplication, scoped ownership, disconnected accounts, strict
  arguments, multiple-account conservation and rejection of score/approval claims.

FP-13/14 and the production authenticated loader/routes/storage are absent in this
checkout. This task provides scoped planning tools and the backend loader interface;
no production database integration, automatic payments or plan acceptance is claimed.

## Pull request requirements
- Branch: `feat/fp-20-debt-readiness-and-goal-negotiation-agents`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #20](https://github.com/ssgadige/FinPilot-HackUTD/issues/20)
