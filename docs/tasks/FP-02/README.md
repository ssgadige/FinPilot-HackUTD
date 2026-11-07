# FP-02 — Login and email verification screens

- Owner lane: A
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-01; FP-10 API contract
- Branch: `feat/fp-02-login-and-email-verification-screens`

## Purpose and scope
Implement password login, pending email-code challenge, resend timer, errors and logout. Connect to B endpoints; no frontend auth bypass.

## Files and boundaries
src/app/login, src/components/auth. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-02; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] No financial page accessible before verification.
- [ ] wrong/expired codes show errors.
- [ ] logout returns to login.
- [ ] network failure is useful..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
