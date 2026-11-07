# FP-06 — Debt goals assets and scenario UI

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 1.5 hours |
| Dependencies | FP-01; FP-13/14/20/21 |
| Priority | P0 |

## Scope
Implement debt table/payment comparisons, goal create/edit, savings/CD/IRA/brokerage snapshots and scenario form/results. Connect accepted plan and version conflicts.

## Implementation area
src/app/debts, src/app/goals, src/app/assets, src/app/scenarios

## Acceptance criteria
- [ ] Create goal changes API.
- [ ] Compare plan and scenario.
- [ ] CD maturity visible.
- [ ] Unsupported credit score prediction absent.
- [ ] Handle 409 stale acceptance.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-06-debt-goals-assets-and-scenario-ui`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #6](https://github.com/ssgadige/FinPilot-HackUTD/issues/6)
