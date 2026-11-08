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
- [ ] 10 users and mixed 12-24-month histories validate.
- [ ] Current balances reconcile.
- [ ] Query helpers enforce ownership/connection selection.
- [ ] One-command setup documented.

## Demo identity and financial history requirements

- Generate ten fictional people with distinct financial profiles.
- Use matching `firstname.lastname@mail.finpilot.test` emails for application and institution simulator sign-in; all disposable demo passwords are `123`. Keep separate salted password hashes.
- Scope institution login lookup and uniqueness by institution ID plus email.
- Generate per-user histories of 12, 15, 18, 21 or 24 complete months, with different start dates and coherent salaries, spending, transfers, subscriptions and debt payments. This replaces the original uniform 30-month requirement. Update the seed, manifest and validator together; do not mark this complete until implemented.
- Reconcile opening balances plus ledger movements to current balances; avoid double-counting transfers or card payments.
- Store generated credentials/database outside git. Credentials include recipient/sender metadata for FP-10/FP-11; no pre-generated OTPs.
- Coordinate any reset of an existing disposable database. The current seed email/password update is in PR #26.

## Pull request requirements
- Branch: `feat/fp-09-database-adapter-and-validated-seed`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #9](https://github.com/ssgadige/FinPilot-HackUTD/issues/9)
