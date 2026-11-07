# FP-16 — Backend security and integration verification

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 3.5 hours |
| Dependencies | FP-10..15 |
| Priority | P0 |

## Scope
Run mandatory SECURITY.md checks, end-to-end session/link/run/plan flows, provider missing/error cases; verify lockfile/build and local persistent data.

## Implementation area
tests, backend fixes, docs/SETUP.md

## Acceptance criteria
- [ ] Auth/ownership/CSRF tests pass.
- [ ] Secrets absent from client/logs/git.
- [ ] Provider failures honest.
- [ ] Reset/reseed documented.
- [ ] Local demo reproducible.

## Pull request requirements
- Branch: `feat/fp-16-backend-security-and-integration-verification`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #16](https://github.com/ssgadige/FinPilot-HackUTD/issues/16)
