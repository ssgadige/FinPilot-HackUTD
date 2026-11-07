# FP-04 — Overview transactions and cash calendar

- Owner lane: A
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-01; FP-12 API
- Branch: `feat/fp-04-overview-transactions-and-cash-calendar`

## Purpose and scope
Render liquid cash/debt/net worth, three explained indicators, forecast, bills and 30-month searchable/paginated history. Investments shown separately from liquid cash.

## Files and boundaries
src/app/overview, src/app/transactions, src/app/cash. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-04; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Filters and pagination work.
- [ ] transfer exclusions match tools.
- [ ] empty/disconnected state helpful.
- [ ] account evidence drawer opens scoped records..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
