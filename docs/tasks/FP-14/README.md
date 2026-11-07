# FP-14 — Goals subscriptions plans and versioning APIs

- Owner lane: B
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-09/10/13
- Branch: `feat/fp-14-goals-subscriptions-plans-and-versioning-apis`

## Purpose and scope
Implement scoped CRUD, preference/actions, proposal persistence, optimistic version acceptance and explicit confirmation. Atomic accepted-plan update; no real financial transactions.

## Files and boundaries
src/app/api/v1/goals, subscriptions, plans, scenarios. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-14; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Two simultaneous accepts return one success/one conflict.
- [ ] action intention not realized savings.
- [ ] accepted plan preserved on failed revision.
- [ ] ownership verified..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
