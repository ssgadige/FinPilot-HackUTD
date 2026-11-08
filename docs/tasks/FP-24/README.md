# FP-24 — Agent integration sponsor evidence and rehearsal

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 3.5 hours |
| Dependencies | FP-17..23; A/B integration |
| Priority | P0 |

## Scope
Validate real run across seeded personas, partial failures, changed snapshot and repair; tune latency/budgets; capture sanitized tool trace and explain external integration.

## Implementation area
tests, docs/DEMO.md, agent fixes

## Acceptance criteria
- [x] Eight specialists + coordinator genuinely wired or limitations disclosed.
- [x] Historical live specialist inference traces retained; fresh integrated live verification pending.
- [x] Fixture data labeled.
- [ ] Three-minute rehearsal succeeds and backup is labeled replay.

## Pull request requirements
- Branch: `feat/fp-24-agent-integration-sponsor-evidence-and-rehearsal`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #24](https://github.com/ssgadige/FinPilot-HackUTD/issues/24)

## Verification status

Local agent/backend tests, TypeScript checks, UI tests and production build pass. The retained specialist traces are historical; local mocked inference is not live evidence. Full three-minute integration acceptance remains **pending**: no successful full integration record is retained, and the user selected local tests only. The replay command labels historical/cached evidence and makes zero new provider calls.

FP-15 run/chat/event routes and conservative monthly application repair are implemented. FP-07 agent workspace, general application planning account mappings and live validation remain required for full browser rehearsal. See [integration verification](../../../src/server/agents/integration/README.md) and [rehearsal guide](../../DEMO.md). This task is not fully accepted yet.
