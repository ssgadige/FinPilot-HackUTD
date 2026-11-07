# FP-22 — Event-driven plan repair specialist

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 1.5 hours |
| Dependencies | FP-20/21; FP-15 event contract |
| Priority | P0 |

## Scope
Consume changed-data event and current plan snapshot; rerun affected tools/roles and produce new proposed version/diff without accepting it automatically.

## Implementation area
src/server/agents/repair

## Acceptance criteria
- [ ] Injected expense triggers real run.
- [ ] Idempotent event.
- [ ] Previous accepted plan retained.
- [ ] Revision has before/after evidence and requires confirmation.

## Pull request requirements
- Branch: `feat/fp-22-event-driven-plan-repair-specialist`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #22](https://github.com/ssgadige/FinPilot-HackUTD/issues/22)
