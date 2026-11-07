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
- [ ] Baseline preserved.
- [ ] Deterministic calculations and explicit assumptions.
- [ ] Result identifies failure date or no failure within tested horizon.
- [ ] No probability claim.

## Pull request requirements
- Branch: `feat/fp-21-stress-test-specialist-and-comparisons`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #21](https://github.com/ssgadige/FinPilot-HackUTD/issues/21)
