# FP-05 — subscriptions and offer comparison

Implemented on the combined `feat/fp-08-frontend-integration-accessibility-and-demo-polish` branch with FP-06–08. Existing uncommitted accounts/session fixes are preserved dependencies, not silently attributed to this task. Nothing is committed or pushed.

## Delivered and acceptance

- Protected `/subscriptions` route reuses the banking shell, cards, fields, tables/status components and account evidence drawer. Candidate merchant, cadence, amount, account, usage and status come from authorized API responses.
- Monthly and annual summary positions are present, but their values remain **Unavailable**: `GET /subscriptions` returns candidates without reconciled billing-period aggregates. The frontend does not invent annual totals, confidence, price changes, overlaps or unused-service claims.
- Used / Unused / Unknown preference confirmation sends `PATCH /subscriptions/:id` with `confirmation:true`, preserves existing preference fields, and refreshes authoritative data when the review closes. Failed inputs remain available for retry.
- Offer comparison displays monthly equivalent, upfront charge, renewal charge, promotion end, eligibility, features, retrieval/verification time and safe source links. Fixture offers display **Sample offer**; cached and live sources have different labels. Missing fields remain unavailable.
- Proposed switch or cancellation intentions require an unchecked explicit confirmation. Duplicate submissions are locked. The request contains exactly one of `offer_id` or `cancel_intention`, plus `confirmation:true`; a returned planned-record ID is required before claiming a save. No purchase, cancellation or realized savings is executed.
- Scoped account evidence, unavailable-provider retry, empty/unlinked states, keyboard operation and responsive dialogs are included. Revocation closes dialogs and removes affected data.

## Files

- `src/app/(workspace)/subscriptions/page.tsx`
- `src/components/planning/subscriptions.tsx`
- Shared task files: `src/lib/workspace-api.ts`, `src/components/planning/{workspace-state,modal,shared}.tsx`, `planning.css`; optional empty-scope support in `src/components/finance/finance-scope.tsx` preserves existing FP-04 defaults.
- Tests: `tests/ui/planning.test.tsx`, `tests/backend/frontend-planning-contract.test.ts`, `tests/e2e/planning.spec.ts`, `tests/fixtures/planning.ts`.

## Verification and real-backend limitations

The isolated backend contract test confirms persisted preferences, reloaded values, planned-intention persistence with zero realized savings, and an unavailable offer provider using actual handlers. These temporary fixture tests are **not** a successful real browser journey.

In real Journey A, Chromium completed password login, fresh Mailpit verification and session validation. The real Institutions catalog now accepts the current `{items}` envelope. The generated institution credential check reached the existing backend, but the separate institution verification screen correctly stopped at its missing verify/resend contract. No accounts were linked. Therefore connected subscription data → confirmed usage → offers → saved intention → reload remains **blocked**, not completed.

Other blockers: `getServices()` creates `Planning` without an offer resolver, so an authorized offer lookup returns 503; no summary aggregate or evidence-backed confidence/price-history fields are supplied. No action-list endpoint exists to redisplay prior action receipts after a full reload. No replacement offers or action-list route was invented.

## Screenshots

All paths below are **labeled automated-response fixtures**, not real backend completion:

- [Subscriptions desktop](evidence/subscriptions-fixture-1440.png), [mobile](evidence/subscriptions-fixture-390.png)
- [Offer comparison desktop](evidence/offers-fixture-1440.png), [mobile](evidence/offers-fixture-390.png)
- [Intention confirmation mobile](evidence/intention-confirmation-fixture-390.png)

Real empty-scope and institution-blocker screenshots, full checks and journey results are in [FP-08](../FP-08/IMPLEMENTATION.md). Axe, focus containment/return, Escape and 390px overflow checks pass for these views. No mocked financial responses are imported by application code.

## Shared final check results

73 component/session tests, 14 backend tests and all 25 Chromium tests pass; typecheck, production build and whitespace checks pass. Lint retains 92 baseline errors and one warning with zero new findings. Real-browser results remain limited to the explicitly described partial journeys; fixture tests do not remove backend blockers.
