# FP-17 — Nemotron adapter and actual tool-call smoke test

- Owner lane: C
- Estimate: 1 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: NVIDIA key/model available later
- Branch: `feat/fp-17-nemotron-adapter-and-actual-tool-call-smoke-test`

## Purpose and scope
Build server-only configurable Nemotron adapter. Select model accessible to team, test a real allowed tool call and model consumption of returned value. Record model/config/latency without secrets.

## Files and boundaries
src/server/nemotron, scripts/smoke-nemotron. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-17; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Real provider tool round trip succeeds.
- [ ] no fixture substituted.
- [ ] timeout/error path explicit.
- [ ] use supported model-specific protocol..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
