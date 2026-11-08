# FP-23 — Coordinator evidence gate and basic chat role

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 1 hour |
| Dependencies | FP-18..22; FP-15 |
| Priority | P0 |

## Scope
Constrained routing/DAG, merge conflict handling and deterministic evidence ownership/numeric checks. Basic Nemotron chat reads findings and requests runs; no extra chatbot features.

## Implementation area
src/server/agents/coordinator, evidence, chat

## Acceptance criteria
- [x] Dependency handoff visible.
- [x] Irrelevant specialist skipped with reason.
- [x] Unknown evidence rejected.
- [x] Chat grounded to same user.
- [x] Global call budget honored.

## Pull request requirements
- Branch: `feat/fp-23-coordinator-evidence-gate-and-basic-chat-role`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #23](https://github.com/ssgadige/FinPilot-HackUTD/issues/23)

## Verification and integration status

Local acceptance scenarios pass in `tests/remaining-agents.test.ts` using mocked inference. See [coordinator, evidence and chat boundaries](../../../src/server/agents/coordinator/README.md). FP-15 application routes are implemented and locally tested. Fresh live coordinator/chat validation remains pending. The user selected local tests only.
