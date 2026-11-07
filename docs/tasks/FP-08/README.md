# FP-08 — Frontend integration accessibility and demo polish

- Owner lane: A
- Estimate: 3.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-02..07; B/C integration
- Branch: `feat/fp-08-frontend-integration-accessibility-and-demo-polish`

## Purpose and scope
Integrate all pages with real APIs, remove unintended response fixtures, fix error/loading/empty states, verify keyboard/responsive UI and rehearse demo.

## Files and boundaries
UI and end-to-end tests. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-08; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Two user journeys complete.
- [ ] no cross-user cached UI.
- [ ] demo simulator labels clear.
- [ ] no dead primary action.
- [ ] build passes.
- [ ] screenshots captured..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
