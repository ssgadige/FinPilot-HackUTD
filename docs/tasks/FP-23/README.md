# FP-23 — Coordinator evidence gate and basic chat role

- Owner lane: C
- Estimate: 1 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-18..22; FP-15
- Branch: `feat/fp-23-coordinator-evidence-gate-and-basic-chat-role`

## Purpose and scope
Constrained routing/DAG, merge conflict handling and deterministic evidence ownership/numeric checks. Basic Nemotron chat reads findings and requests runs; no extra chatbot features.

## Files and boundaries
src/server/agents/coordinator, evidence, chat. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-23; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Dependency handoff visible.
- [ ] irrelevant specialist skipped with reason.
- [ ] unknown evidence rejected.
- [ ] chat grounded to same user.
- [ ] global call budget honored..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
