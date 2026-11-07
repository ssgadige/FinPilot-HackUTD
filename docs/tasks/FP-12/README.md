# FP-12 — Scoped finance read APIs and aggregates

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 1.5 hours |
| Dependencies | FP-09/10/11 |
| Priority | P0 |

## Scope
Implement filters/pagination and SQL aggregates excluding paired owned-account transfers from cash flow. Mask last four, handle absent linked data and separate assets/liabilities.

## Implementation area
src/app/api/v1/accounts, transactions, overview, forecast

## Acceptance criteria
- [ ] 30 months queryable.
- [ ] No leaked hashes/secrets.
- [ ] All object identifiers ownership tested.
- [ ] Overview matches ledger and indicator definitions.

## Pull request requirements
- Branch: `feat/fp-12-scoped-finance-read-apis-and-aggregates`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #12](https://github.com/ssgadige/FinPilot-HackUTD/issues/12)
