# FP-10 — Password email challenge and sessions

- Owner lane: B
- Estimate: 2 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-09
- Branch: `feat/fp-10-password-email-challenge-and-sessions`

## Purpose and scope
Implement scrypt verification, random HMAC-protected email codes, Mailpit SMTP, throttling, pending cookie, authenticated session, CSRF/origin controls and logout.

## Files and boundaries
src/server/auth, src/app/api/v1/auth. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-10; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Wrong/expired/replayed OTP tests.
- [ ] no session before verification.
- [ ] cooldown and attempt limits.
- [ ] logout revokes.
- [ ] no secrets in responses/logs..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
