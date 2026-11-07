# FP-03 — Institution catalog and simulated linking

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 2 hours |
| Dependencies | FP-01; FP-11 API |
| Priority | P0 |

## Scope
Build category cards and provider grid; simulator warning, fake credentials form, consent, account selection, connected status, sync/disconnect. Clear secrets from form memory after submit.

## Implementation area
src/app/institutions, src/components/connections

## Acceptance criteria
- [ ] PNC/BoA/Chase discoverable by category.
- [ ] Link only selected accounts.
- [ ] Invalid fake login fails.
- [ ] Reconnect does not duplicate.
- [ ] Disconnect updates dashboard.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-03-institution-catalog-and-simulated-linking`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #3](https://github.com/ssgadige/FinPilot-HackUTD/issues/3)
