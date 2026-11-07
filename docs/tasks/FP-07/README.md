# FP-07 — Agent workspace and basic chatbot

- Owner lane: A
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-01; FP-15/23
- Branch: `feat/fp-07-agent-workspace-and-basic-chatbot`

## Purpose and scope
Display nine agent roles, true run events/tool activity, findings and evidence; poll status. Add basic Nemotron chat side panel with request-checkup and explain-finding interactions.

## Files and boundaries
src/app/agents, src/components/chat. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-07; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] No fake typing/agent completion.
- [ ] failures/skips/stale results labeled.
- [ ] chat response from real endpoint.
- [ ] evidence opens correctly..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
