# FP-15 — Agent run events chat routes and change trigger

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 1.5 hours |
| Dependencies | FP-10/12/14; C runtime |
| Priority | P0 |

## Scope
Connect C runner to authenticated routes, polling events, persisted run steps and request budgets. Demo event is idempotent/user-scoped, increments snapshot and triggers proposed repair.

## Implementation area
src/app/api/v1/runs, chat, demo/events

## Acceptance criteria
- [x] Checkup returns 202 and status.
- [x] Cancellation stops new calls.
- [x] Duplicate event not applied twice.
- [x] Chatbot cannot supply user identity.
- [x] Stale snapshot visible.

## Pull request requirements
- Branch: `feat/fp-15-agent-run-events-chat-routes-and-change-trigger`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #15](https://github.com/ssgadige/FinPilot-HackUTD/issues/15)

## Implementation and acceptance evidence

Delivered together on `feat/fp-15-16-authenticated-agent-integration`; no shared API payload contracts changed. See [run service and boundaries](../../../src/server/runs/README.md), [backend acceptance tests](../../../tests/backend/runs.test.ts), [local acceptance record](../../../src/server/runs/local-acceptance.json) and [setup/reset guide](../../../SETUP.md).

Verification uses real SQLite, authenticated HTTP handlers, deterministic tools and local SMTP; provider inference is mocked. Missing/failed providers, stale snapshots, cancellation, two-user ownership, identity injection and duplicate/failed events are exercised. A production build and configured-secret/browser-bundle audit are included. Existing repository-wide explicit-any lint debt is disclosed; this is not a claim of production certification, live NVIDIA verification, Docker-daemon validation or a finished FP-07 UI.
