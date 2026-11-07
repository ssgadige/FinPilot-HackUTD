# FP-22 — Event-driven plan repair specialist

- Owner lane: C
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-20/21; FP-15 event contract
- Branch: `feat/fp-22-event-driven-plan-repair-specialist`

## Purpose and scope
Consume changed-data event and current plan snapshot; rerun affected tools/roles and produce new proposed version/diff without accepting it automatically.

## Files and boundaries
src/server/agents/repair. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-22; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Injected expense triggers real run.
- [ ] idempotent event.
- [ ] previous accepted plan retained.
- [ ] revision has before/after evidence and requires confirmation..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
