# FP-09 — Database adapter and validated seed

- Owner lane: B
- Estimate: 1 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: None
- Branch: `feat/fp-09-database-adapter-and-validated-seed`

## Purpose and scope
Review supplied schema/generator; add SQLite adapter, transactions, migration/bootstrap command, session-scoped query helpers and ledger access. Preserve generated local secret files outside git.

## Files and boundaries
src/server/db, data/schema.sql, scripts. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-09; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] 10 users and 30-month history validate.
- [ ] current balances reconcile.
- [ ] query helpers enforce ownership/connection selection.
- [ ] one-command setup documented..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
