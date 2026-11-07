# FP-02 — Login and email verification screens

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 1.5 hours |
| Dependencies | FP-01; FP-10 API contract |
| Priority | P0 |

## Scope
Implement password login, pending email-code challenge, resend timer, errors and logout. Connect to B endpoints; no frontend auth bypass.

## Implementation area
src/app/login, src/components/auth

## Acceptance criteria
- [ ] No financial page accessible before verification.
- [ ] Wrong/expired codes show errors.
- [ ] Logout returns to login.
- [ ] Network failure is useful.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-02-login-and-email-verification-screens`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #2](https://github.com/ssgadige/FinPilot-HackUTD/issues/2)
