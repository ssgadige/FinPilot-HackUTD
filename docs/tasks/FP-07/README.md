# FP-07 — Agent workspace and basic chatbot

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 1.5 hours |
| Dependencies | FP-01; FP-15/23 |
| Priority | P0 |

## Scope
Display nine agent roles, true run events/tool activity, findings and evidence; poll status. Add basic Nemotron chat side panel with request-checkup and explain-finding interactions.

## Implementation area
src/app/agents, src/components/chat

## Acceptance criteria
- [ ] No fake typing/agent completion.
- [ ] Failures/skips/stale results labeled.
- [ ] Chat response from real endpoint.
- [ ] Evidence opens correctly.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-07-agent-workspace-and-basic-chatbot`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #7](https://github.com/ssgadige/FinPilot-HackUTD/issues/7)
