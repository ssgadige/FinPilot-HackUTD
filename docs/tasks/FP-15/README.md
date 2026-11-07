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
- [ ] Checkup returns 202 and status.
- [ ] Cancellation stops new calls.
- [ ] Duplicate event not applied twice.
- [ ] Chatbot cannot supply user identity.
- [ ] Stale snapshot visible.

## Pull request requirements
- Branch: `feat/fp-15-agent-run-events-chat-routes-and-change-trigger`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #15](https://github.com/ssgadige/FinPilot-HackUTD/issues/15)
