# FP-04 — Overview transactions and cash calendar

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 1.5 hours |
| Dependencies | FP-01; FP-12 API |
| Priority | P0 |

## Scope
Render liquid cash/debt/net worth, three explained indicators, forecast, bills and 30-month searchable/paginated history. Investments shown separately from liquid cash.

## Implementation area
src/app/overview, src/app/transactions, src/app/cash

## Acceptance criteria
- [ ] Filters and pagination work.
- [ ] Transfer exclusions match tools.
- [ ] Empty/disconnected state helpful.
- [ ] Account evidence drawer opens scoped records.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-04-overview-transactions-and-cash-calendar`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #4](https://github.com/ssgadige/FinPilot-HackUTD/issues/4)
