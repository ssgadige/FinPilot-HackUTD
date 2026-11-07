# FP-10 — Password email challenge and sessions

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 2 hours |
| Dependencies | FP-09 |
| Priority | P0 |

## Scope
Implement scrypt verification, random HMAC-protected email codes, Mailpit SMTP, throttling, pending cookie, authenticated session, CSRF/origin controls and logout.

## Implementation area
src/server/auth, src/app/api/v1/auth

## Acceptance criteria
- [ ] Wrong/expired/replayed OTP tests.
- [ ] No session before verification.
- [ ] Cooldown and attempt limits.
- [ ] Logout revokes.
- [ ] No secrets in responses/logs.

## Pull request requirements
- Branch: `feat/fp-10-password-email-challenge-and-sessions`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #10](https://github.com/ssgadige/FinPilot-HackUTD/issues/10)
