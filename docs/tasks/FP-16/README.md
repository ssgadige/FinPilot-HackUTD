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
- [x] Auth/ownership/CSRF tests pass.
- [x] Secrets absent from client/logs/git.
- [x] Provider failures honest.
- [x] Reset/reseed documented.
- [x] Local demo reproducible.

## Pull request requirements
- Branch: `feat/fp-16-backend-security-and-integration-verification`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #16](https://github.com/ssgadige/FinPilot-HackUTD/issues/16)

## Implementation and acceptance evidence

Delivered together on `feat/fp-15-16-authenticated-agent-integration`; no shared API payload contracts changed. See [run service and boundaries](../../../src/server/runs/README.md), [backend acceptance tests](../../../tests/backend/runs.test.ts), [local acceptance record](../../../src/server/runs/local-acceptance.json) and [setup/reset guide](../../../SETUP.md).

Verification uses real SQLite, authenticated HTTP handlers, deterministic tools and local SMTP; provider inference is mocked. Missing/failed providers, stale snapshots, cancellation, two-user ownership, identity injection and duplicate/failed events are exercised. A production build and configured-secret/browser-bundle audit are included. Existing repository-wide explicit-any lint debt is disclosed; this is not a claim of production certification, live NVIDIA verification, Docker-daemon validation or a finished FP-07 UI.
