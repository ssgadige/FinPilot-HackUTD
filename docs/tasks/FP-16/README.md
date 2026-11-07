# FP-16 — Backend security and integration verification

- Owner lane: B
- Estimate: 3.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-10..15
- Branch: `feat/fp-16-backend-security-and-integration-verification`

## Purpose and scope
Run mandatory SECURITY.md checks, end-to-end session/link/run/plan flows, provider missing/error cases; verify lockfile/build and local persistent data.

## Files and boundaries
tests, backend fixes, docs/SETUP.md. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-16; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Auth/ownership/CSRF tests pass.
- [ ] secrets absent from client/logs/git.
- [ ] provider failures honest.
- [ ] reset/reseed documented.
- [ ] local demo reproducible..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
