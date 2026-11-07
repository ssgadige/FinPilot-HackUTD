# FP-24 — Agent integration sponsor evidence and rehearsal

- Owner lane: C
- Estimate: 3.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-17..23; A/B integration
- Branch: `feat/fp-24-agent-integration-sponsor-evidence-and-rehearsal`

## Purpose and scope
Validate real run across seeded personas, partial failures, changed snapshot and repair; tune latency/budgets; capture sanitized tool trace and explain external integration.

## Files and boundaries
tests, docs/DEMO.md, agent fixes. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-24; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Eight specialists + coordinator genuinely wired or limitations disclosed.
- [ ] live inference trace retained.
- [ ] fixture data labeled.
- [ ] three-minute rehearsal succeeds and backup is labeled replay..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
