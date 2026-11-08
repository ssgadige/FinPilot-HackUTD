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

## Demo email verification requirements

- Read the generated user email and salted hash from FP-09; accept `123` only for the seeded simulation accounts. Preserve any production password policy.
- After password verification, deliver a fresh six-digit code to that exact sign-in email using local Mailpit.
- Sender: `FinPilot Demo <security@finpilot.test>`; subject identifies FinPilot and the sign-in purpose.
- Display the masked recipient and a clear simulation label. Do not create a finance session before code verification.
- Codes expire after five minutes, are single-use, allow at most five attempts, and use a 60-second resend cooldown. Resend invalidates the prior code.
- Never use `123` as a verification code. Never return codes to the browser, include them in model context or log them.
- Verify wrong/expired/replayed codes, resend invalidation, delivery failure, throttling and logout. Fake addresses receive mail in the local test inbox, not external providers.

## Pull request requirements
- Branch: `feat/fp-10-password-email-challenge-and-sessions`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #10](https://github.com/ssgadige/FinPilot-HackUTD/issues/10)
