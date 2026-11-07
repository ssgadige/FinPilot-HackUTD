# FP-12 — Scoped finance read APIs and aggregates

- Owner lane: B
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-09/10/11
- Branch: `feat/fp-12-scoped-finance-read-apis-and-aggregates`

## Purpose and scope
Implement filters/pagination and SQL aggregates excluding paired owned-account transfers from cash flow. Mask last four, handle absent linked data and separate assets/liabilities.

## Files and boundaries
src/app/api/v1/accounts, transactions, overview, forecast. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-12; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] 30 months queryable.
- [ ] no leaked hashes/secrets.
- [ ] all object identifiers ownership tested.
- [ ] overview matches ledger and indicator definitions..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
