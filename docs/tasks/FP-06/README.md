# FP-06 — Debt goals assets and scenario UI

- Owner lane: A
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-01; FP-13/14/20/21
- Branch: `feat/fp-06-debt-goals-assets-and-scenario-ui`

## Purpose and scope
Implement debt table/payment comparisons, goal create/edit, savings/CD/IRA/brokerage snapshots and scenario form/results. Connect accepted plan and version conflicts.

## Files and boundaries
src/app/debts, src/app/goals, src/app/assets, src/app/scenarios. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-06; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Create goal changes API.
- [ ] compare plan and scenario.
- [ ] CD maturity visible.
- [ ] unsupported credit score prediction absent.
- [ ] handle 409 stale acceptance..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
