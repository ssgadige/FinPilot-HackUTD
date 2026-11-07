# FP-18 — Bounded agent runtime integrity and cash agents

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 2 hours |
| Dependencies | FP-17; FP-13 contract |
| Priority | P0 |

## Scope
Implement shared validated tool loop, role allowlists, result validation, events and budgets. Wire Data Integrity and Cash Collision prompts to real tools.

## Implementation area
src/server/agents/runtime, integrity, cash

## Acceptance criteria
- [ ] Actual tool trace.
- [ ] Integrity catches transfer/data issues.
- [ ] Cash identifies a dated collision from tools.
- [ ] Malformed result retry bounded.
- [ ] Ownership context immutable.

## Pull request requirements
- Branch: `feat/fp-18-bounded-agent-runtime-integrity-and-cash-agents`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #18](https://github.com/ssgadige/FinPilot-HackUTD/issues/18)
