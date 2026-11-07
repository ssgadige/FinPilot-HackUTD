# FP-01 — App scaffold and shared UI

- Owner lane: A
- Estimate: 1 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: None
- Branch: `feat/fp-01-app-scaffold-and-shared-ui`

## Purpose and scope
Create Next.js TypeScript scaffold without overwriting planning files; add shared shell, navigation, cards, forms, tables and chart wrapper. Commit lockfile and dev/build/lint/test scripts.

## Files and boundaries
src/app, src/components, package.json, lockfile. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-01; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] App starts on localhost.
- [ ] all navigation sections reachable.
- [ ] keyboard focus and mobile navigation work.
- [ ] build/lint pass..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
