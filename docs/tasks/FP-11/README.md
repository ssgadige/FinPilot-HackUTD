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

## Pull request requirements
- Branch: `feat/fp-11-simulated-institution-connection-backend`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #11](https://github.com/ssgadige/FinPilot-HackUTD/issues/11)
