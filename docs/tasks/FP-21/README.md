# FP-21 — Stress-test specialist and comparisons

- Owner lane: C
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-20; FP-13
- Branch: `feat/fp-21-stress-test-specialist-and-comparisons`

## Purpose and scope
Run fixed delayed-income, surprise-expense and reduced-income scenarios on candidate plans; compare first shortfall, minimum balance and goal changes.

## Files and boundaries
src/server/agents/stress. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-21; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Baseline preserved.
- [ ] deterministic calculations and explicit assumptions.
- [ ] result identifies failure date or no failure within tested horizon.
- [ ] no probability claim..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
