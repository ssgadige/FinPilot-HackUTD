# FP-15 — Agent run events chat routes and change trigger

- Owner lane: B
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-10/12/14; C runtime
- Branch: `feat/fp-15-agent-run-events-chat-routes-and-change-trigger`

## Purpose and scope
Connect C runner to authenticated routes, polling events, persisted run steps and request budgets. Demo event is idempotent/user-scoped, increments snapshot and triggers proposed repair.

## Files and boundaries
src/app/api/v1/runs, chat, demo/events. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-15; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Checkup returns 202 and status.
- [ ] cancellation stops new calls.
- [ ] duplicate event not applied twice.
- [ ] chatbot cannot supply user identity.
- [ ] stale snapshot visible..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
