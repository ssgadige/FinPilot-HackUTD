# FP-08 — Frontend integration accessibility and demo polish

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 3.5 hours |
| Dependencies | FP-02..07; B/C integration |
| Priority | P0 |

## Scope
Integrate all pages with real APIs, remove unintended response fixtures, fix error/loading/empty states, verify keyboard/responsive UI and rehearse demo.

## Implementation area
UI and end-to-end tests

## Acceptance criteria
- [ ] Two user journeys complete.
- [ ] No cross-user cached UI.
- [ ] Demo simulator labels clear.
- [ ] No dead primary action.
- [ ] Build passes.
- [ ] Screenshots captured.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-08-frontend-integration-accessibility-and-demo-polish`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #8](https://github.com/ssgadige/FinPilot-HackUTD/issues/8)
