# FP-05 — Subscription manager and offer comparison

- Owner lane: A
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-01; FP-13; FP-19
- Branch: `feat/fp-05-subscription-manager-and-offer-comparison`

## Purpose and scope
Show recurring candidates, confidence, price changes, preference confirmation and comparable offers. Distinguish fixture/live, promotional/renewal prices, annual upfront charges and intention vs confirmed change.

## Files and boundaries
src/app/subscriptions. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-05; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] User can confirm preferences and save proposed action.
- [ ] sample offer badge visible.
- [ ] no fabricated unused claim.
- [ ] no cancellation/purchase performed..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
