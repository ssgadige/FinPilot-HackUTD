# FP-11 — Simulated institution connection backend

- Owner lane: B
- Estimate: 2 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-09/10
- Branch: `feat/fp-11-simulated-institution-connection-backend`

## Purpose and scope
Implement fake-login preview token, owned-account selection/consent, connection/sync/revoke, idempotency and server-scoped account visibility. No bank network requests.

## Files and boundaries
src/server/simulator, src/app/api/v1/connections. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-11; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Wrong institution/user rejected.
- [ ] cannot link another person’s account.
- [ ] only selected accounts visible.
- [ ] repeated sync safe.
- [ ] disconnect makes history and related evidence inaccessible..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
