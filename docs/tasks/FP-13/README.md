# FP-13 — Calculation tool library

- Owner lane: B
- Estimate: 1 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-09; contracts/types.ts
- Branch: `feat/fp-13-calculation-tool-library`

## Purpose and scope
Build pure integer-cent cash forecast, recurring detection/normalization, amortization, utilization and bounded stress calculations; provide stable evidence IDs and assumptions.

## Files and boundaries
src/server/tools/finance. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-13; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Known payment/interest examples verified.
- [ ] no double-counted transfers or savings.
- [ ] zero/missing income handled.
- [ ] tools reject invalid ranges..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
