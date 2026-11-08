# FP-06 — debt, goals, assets and scenarios

## Current integrated review status

Reviewed main and complete institution verification are integrated. Real goal create/edit, debt comparisons, account-backed scenario/evidence and installed investment linking have passed Chromium/Mailpit testing on an isolated backup. Financial DTOs are aligned without client authoritative arithmetic. Real plan acceptance remains blocked by missing Nemotron configuration and no returned proposal; fixture 409/version/idempotency tests pass. CD/IRA records absent from these installed users remain unavailable. Historical notes below refer to the initial checkpoint; use FP-08/IMPLEMENTATION.md for current checks.

## Historical checkpoint notes


Implemented together with FP-05/07/08 on `feat/fp-08-frontend-integration-accessibility-and-demo-polish`. No changes to financial formulas, authentication semantics, database schemas, seeding or registration.

## Delivered and files

- Independently protected workspace routes: `debt-and-readiness/page.tsx`, `goals-and-plans/page.tsx`, `assets/page.tsx`, `scenario-lab/page.tsx` under `src/app/(workspace)`.
- `src/components/planning/finance-pages.tsx`: scoped debt inventory, payment comparisons, asset categories and scenario controls/results.
- `src/components/planning/goals-plans.tsx`: goal create/edit, progress/deadline/priority, existing plan review and explicit acceptance.
- Shared DTO/request/state/dialog/evidence helpers in `src/lib/workspace-api.ts` and `src/components/planning`.

Debt balances, APR, minimums, limits and utilization use returned fields; missing values remain unavailable. Hypothetical baseline/extra-payment alternatives both call `POST /calculations` using its inspected integer-cent/basis-point/month schema. Interest, payment, total paid, remaining balance, payoff months and assumptions come from the server. No credit-score prediction, approval claim or second frontend financial formula is added. Cash-buffer affordability is explicitly outside this calculator's returned results.

Goals validate title, positive USD target, deadline and priority, preserve input on failures, send real POST/PATCH requests and refresh authoritative lists after success. Saved progress is separate from proposed plan allocations. Goals can be created with no linked accounts; no cash is transferred or implicitly reserved.

Assets separate checking/savings from CDs/IRAs/brokerage. The accounts response lacked CD maturity although the owned database row already had it. The **only new backend compatibility field** is optional `maturity_date` on authorized CD summaries: `contracts/types.ts`, `src/server/finance.ts` and its decoder in `src/lib/finance-api.ts`. It reads the existing column; there is no migration, manufactured date or balance. Individual valuation timestamps and maturity/yield projections remain unknown when absent.

Scenarios support surprise expense, delayed income and income reduction with the current POST payloads and optional existing plan ID. Returned dated balances have a readable table alternative, low-cash date, reserves, assumptions and scoped `/evidence/:id` access. No baseline comparison or changed goal deadline is invented when the endpoint returns only stressed values. Empty account scope disables account-backed scenario execution with an explanation.

Plan acceptance requires a review, unchecked explicit confirmation, `expected_version` and an in-memory idempotency key retained for the same network retry. A 409 closes the old review, fetches the latest list and announces that fresh review is required. It never automatically retries a newer version. Stale plans cannot be accepted. All alternatives remain separate; allocations are not summed across plans.

## Acceptance evidence

- **Real Chromium/Mailpit Journey B:** different verified user; goal created, edited, reloaded and confirmed persisted; user A's sentinel goal absent; direct foreign-goal API read returns 404. Two hypothetical payment alternatives came from the real server calculator. Logout and former-cookie rejection pass.
- **Blocked real steps:** no linked accounts because institution verification is unavailable; linked debt/assets/CD inspection, account-backed scenarios and real plan acceptance/stale-plan interaction cannot complete. No plan proposal was created in the browser or injected into the isolated rehearsal database.
- **Automated-only evidence:** component tests cover 409 review, retained idempotency, returned scenario/evidence, missing values, CD separation, failed-input preservation and stale user-response rejection. Actual backend handler tests verify the optional CD field, DTOs, preference/goal persistence and ownership in temporary fixtures. This is not a claim of a full live plan journey.

## Labeled fixture screenshots

- Debt: [1440px](evidence/debts-fixture-1440.png), [390px](evidence/debts-fixture-390.png)
- Goals/plans: [1440px](evidence/goals-fixture-1440.png), [390px](evidence/goals-fixture-390.png)
- Assets: [1440px](evidence/assets-fixture-1440.png), [390px](evidence/assets-fixture-390.png)
- Scenarios: [1440px](evidence/scenarios-fixture-1440.png), [390px](evidence/scenarios-fixture-390.png)
- [Goal editor](evidence/goal-editor-fixture-390.png), [409 review state](evidence/stale-plan-fixture-390.png), [returned scenario table](evidence/scenario-result-fixture-390.png)

These screenshots use **labeled test responses**. Real goal persistence and calculator screenshots, full check counts and preserved-work details are in [FP-08](../FP-08/IMPLEMENTATION.md). Related backend dependencies are the FP-12 account metadata agreement, FP-14 goal/plan/scenario handlers and FP-13 deterministic calculation endpoint; populated planning flows still need verified linked data and server-generated plans.

## Shared final check results

73 component/session tests, 14 backend tests and all 25 Chromium tests pass; typecheck, production build and whitespace checks pass. Lint retains 92 baseline errors and one warning with zero new findings. Real-browser results remain limited to the explicitly described partial journeys; fixture tests do not remove backend blockers.
