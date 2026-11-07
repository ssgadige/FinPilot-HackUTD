# FP-09 — Database adapter and validated seed

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 1 hour |
| Dependencies | None |
| Priority | P0 |

## Scope
Review supplied schema/generator; add SQLite adapter, transactions, migration/bootstrap command, session-scoped query helpers and ledger access. Preserve generated local secret files outside git.

## Implementation area
src/server/db, data/schema.sql, scripts

## Acceptance criteria
- [ ] 10 users and 30-month history validate.
- [ ] Current balances reconcile.
- [ ] Query helpers enforce ownership/connection selection.
- [ ] One-command setup documented.

## Pull request requirements
- Branch: `feat/fp-09-database-adapter-and-validated-seed`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #9](https://github.com/ssgadige/FinPilot-HackUTD/issues/9)
