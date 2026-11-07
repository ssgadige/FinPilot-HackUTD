# FP-03 — Institution catalog and simulated linking

- Owner lane: A
- Estimate: 2 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-01; FP-11 API
- Branch: `feat/fp-03-institution-catalog-and-simulated-linking`

## Purpose and scope
Build category cards and provider grid; simulator warning, fake credentials form, consent, account selection, connected status, sync/disconnect. Clear secrets from form memory after submit.

## Files and boundaries
src/app/institutions, src/components/connections. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-03; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] PNC/BoA/Chase discoverable by category.
- [ ] link only selected accounts.
- [ ] invalid fake login fails.
- [ ] reconnect does not duplicate.
- [ ] disconnect updates dashboard..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
