# FP-11 — Simulated institution connection backend

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 2 hours |
| Dependencies | FP-09/10 |
| Priority | P0 |

## Scope
Implement fake-login preview token, owned-account selection/consent, connection/sync/revoke, idempotency and server-scoped account visibility. No bank network requests.

## Implementation area
src/server/simulator, src/app/api/v1/connections

## Acceptance criteria
- [ ] Wrong institution/user rejected.
- [ ] Cannot link another person’s account.
- [ ] Only selected accounts visible.
- [ ] Repeated sync safe.
- [ ] Disconnect makes history and related evidence inaccessible.

## Institution email verification requirements

- Require an authenticated FinPilot session before starting institution linking.
- Authenticate the selected simulated institution using institution ID, the person's matching email and their seeded password `123`; enforce ownership against the session user.
- Before issuing a successful preview token or exposing account labels, send a separate fresh six-digit verification code to the institution identity's email.
- Sender display name identifies the provider plus `Simulator`, for example `Chase Simulator <verification@chase.finpilot.test>`. Use only local Mailpit; do not spoof actual bank domains or contact real banks.
- Reuse FP-10's challenge primitives with purpose `institution-link`, bound to the session user, institution, pending link attempt and recipient. App-login codes and other institutions' codes must not be interchangeable.
- Provide separate preview-start, verify and resend handling. The initial request returns only a challenge ID and masked recipient; verification returns the short-lived owned-account preview. Coordinate the endpoint contract with FP-03 before integration.
- Apply the same expiry, attempt limits, resend invalidation and delivery-failure behavior as FP-10. Revoke pending link challenges on disconnect/logout.
- Test wrong institution, cross-user attempt, app-code reuse, code replay, expiry, failed delivery, consent and selected-account visibility.

## Pull request requirements
- Branch: `feat/fp-11-simulated-institution-connection-backend`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #11](https://github.com/ssgadige/FinPilot-HackUTD/issues/11)
