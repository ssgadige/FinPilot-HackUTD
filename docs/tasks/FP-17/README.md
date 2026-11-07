# FP-17 — Nemotron adapter and actual tool-call smoke test

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 1 hour |
| Dependencies | NVIDIA key/model available later |
| Priority | P0 |

## Scope
Build server-only configurable Nemotron adapter. Select model accessible to team, test a real allowed tool call and model consumption of returned value. Record model/config/latency without secrets.

## Implementation area
src/server/nemotron, scripts/smoke-nemotron

## Acceptance criteria
- [ ] Real provider tool round trip succeeds.
- [ ] No fixture substituted.
- [ ] Timeout/error path explicit.
- [ ] Use supported model-specific protocol.

## Pull request requirements
- Branch: `feat/fp-17-nemotron-adapter-and-actual-tool-call-smoke-test`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #17](https://github.com/ssgadige/FinPilot-HackUTD/issues/17)
