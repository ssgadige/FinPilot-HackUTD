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
- [ ] Distinct alternatives with calculated totals.
- [ ] Same money not allocated twice.
- [ ] No invented credit score or approval.
- [ ] Missing APR/limit flagged.

## Pull request requirements
- Branch: `feat/fp-20-debt-readiness-and-goal-negotiation-agents`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #20](https://github.com/ssgadige/FinPilot-HackUTD/issues/20)
