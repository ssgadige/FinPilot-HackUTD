# FP-20 — Debt readiness and goal negotiation agents

- Owner lane: C
- Estimate: 2 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-18; FP-13/14
- Branch: `feat/fp-20-debt-readiness-and-goal-negotiation-agents`

## Purpose and scope
Wire payoff/utilization tools and shared budget constraints. Generate competing goal/debt allocations with reserved bills/buffer and only confirmed cost changes.

## Files and boundaries
src/server/agents/debt, goals. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-20; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Distinct alternatives with calculated totals.
- [ ] same money not allocated twice.
- [ ] no invented credit score or approval.
- [ ] missing APR/limit flagged..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
