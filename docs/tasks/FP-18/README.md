# FP-18 — Bounded agent runtime integrity and cash agents

- Owner lane: C
- Estimate: 2 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-17; FP-13 contract
- Branch: `feat/fp-18-bounded-agent-runtime-integrity-and-cash-agents`

## Purpose and scope
Implement shared validated tool loop, role allowlists, result validation, events and budgets. Wire Data Integrity and Cash Collision prompts to real tools.

## Files and boundaries
src/server/agents/runtime, integrity, cash. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-18; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Actual tool trace.
- [ ] integrity catches transfer/data issues.
- [ ] cash identifies a dated collision from tools.
- [ ] malformed result retry bounded.
- [ ] ownership context immutable..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
