# FP-19 — Subscription and deal scout agents with source adapter

- Owner lane: C
- Estimate: 1.5 person-hours
- Priority: P0 (scoped prototype)
- Status: Backlog
- Dependencies: FP-17/18; merchant and offer tools
- Branch: `feat/fp-19-subscription-and-deal-scout-agents-with-source-adapter`

## Purpose and scope
Wire recurring candidates and preferences into Subscription Detective, then Deal Scout. Implement one allowlisted external public offer retrieval with provenance; labeled fixture fallback; comparable cost tool.

## Files and boundaries
src/server/agents/subscriptions, deals, src/server/offers. Read docs/API.md, contracts/types.ts, docs/SECURITY.md and docs/AGENTS.md before work. Coordinate shared files instead of overwriting another lane's implementation.

## Steps
1. Confirm dependency contracts; use clearly labeled contract fixtures only while endpoints are being built.
2. Implement this scope with authenticated user isolation, honest source modes and useful failure states.
3. Connect to the corresponding API/tool/UI and verify the acceptance criteria.
4. Open a small PR referencing FP-19; include commands/evidence and unresolved limitations.

## Acceptance criteria
- [ ] Price/terms evidence attached.
- [ ] annual upfront/promo eligibility handled.
- [ ] unverified/no comparable offer returns uncertainty.
- [ ] failed fetch never labeled live.
- [ ] no arbitrary URL or purchase tool..

## Verification and handoff
Attach the relevant automated check output or a short reproducible manual journey. Security/math tasks require behavioral tests. Mark Done only after reviewer verification. Never commit generated credentials, database files, real financial data or API keys. Missing provider access is Blocked, not Done.

## Out of scope
Unrelated chatbot enhancements, real bank authentication/money movement, production compliance claims, and features not needed for the scoped acceptance criteria.
