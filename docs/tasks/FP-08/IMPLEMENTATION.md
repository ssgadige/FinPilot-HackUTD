# FP-05–08 combined frontend integration and demo handoff

Branch: `feat/fp-08-frontend-integration-accessibility-and-demo-polish`. This intentionally combines frontend tasks FP-05, FP-06, FP-07 and FP-08. Nothing is staged, committed, pushed, merged or closed.

## Existing work preserved

The initial branch was `fix/accounts-snapshot-and-session-redirect`, with the accounts snapshot/session error-brand fix uncommitted. Its shared account envelope, authenticated snapshot lookup, typed server errors, session redirect semantics, tests and `docs/fixes` handoff/evidence remain in place. They are **pre-existing dependencies**, not newly attributed FP-05–08 work. The combined working tree still contains that separate fix. Before creating a clean PR, land or stage that dependency separately; do not silently bundle it.

Task-specific changes overlapping those files are limited to the optional authorized CD `maturity_date` response/type/decoder. No other prior fix behavior is overwritten. Existing source/planning files and historical screenshot evidence are preserved. No commits or destructive git operations were used to move branches.

The supplied PDF pages 25–49 and the four task READMEs/UI/API/security/agent/shared-type guidance were reviewed. Components are real accessible React controls, never PDF images.

## Dependency map

| Area | Implemented HTTP support | Remaining dependency or mismatch |
| --- | --- | --- |
| Subscriptions | GET list, PATCH confirmed preferences, GET offers, POST planned action | No reconciled monthly/annual summary or confidence/price-history fields. Offer resolver absent in `getServices`; no saved-action listing endpoint. |
| Debt/assets | GET debts/accounts, POST calculations, GET evidence | Unknown values stay unavailable; individual valuation timestamps absent. Optional owned CD maturity is now exposed from its existing column. |
| Goals/plans/scenarios | Goal CRUD, list/detail/accept plans, POST scenarios | Populated data requires verified linking; new plans require server planning execution. No client plan creation or fabricated baseline. |
| Runs/chat | Runtime modules only; no HTTP run/chat routes found | FP-15/23 handler/envelope wiring and teammate-owned chat component/API remain blocked. |
| Institutions | Real `{items}` catalog normalized by the existing frontend adapter | Institution verify/resend contract is still missing; legacy preview cannot release account access in the frontend. |
| Existing FP-04 populated views | Snapshot/session dependency preserved | Other transaction/overview/forecast response fields still need separate FP-04/FP-12 coordination; not falsely declared solved by empty-scope tests. |

## New shared behavior and logical task changes

- `src/lib/workspace-api.ts`: inspected DTO adapters; same-origin/no-store requests, required session-bound CSRF on mutations, safe errors, input-unit parsing only. No financial formulas, response fixtures, storage-backed data or model client.
- `src/components/planning/{workspace-state,modal,shared}.tsx`, `planning.css`: serial request lifetime, stale-response protection, duplicate mutation locks, response acknowledgment checks, accessible native review dialogs and scoped evidence reads. Financial scope is cleared on auth/revocation; existing `finpilot:finance-invalidated` is honored.
- `FinanceScope` gains opt-in `allowEmpty` for goal management and informative new pages. Its default FP-04 empty-state behavior and server boundary are unchanged.
- Six dedicated routes remain inside `src/app/(workspace)` and independently require a verified server session. Generic section generation excludes them. Navigation URLs are unchanged.
- FP-05: subscription review, preferences, term/source comparison and intention confirmation. FP-06: debt comparisons, goals, assets, existing plan review and scenarios. FP-07: real-data-only agent workspace and teammate chat boundary. See their individual handoffs for acceptance and file details.
- Narrow compatibility fixes: normalize the actual Institutions `{items}` envelope while retaining legacy test arrays; expose optional owned CD maturity; replace obsolete login copy that still said server authentication was unimplemented. No authentication grant, institution verification or financial calculation was changed.
- Tests are extended in `tests/ui/planning.test.tsx`, `tests/backend/frontend-planning-contract.test.ts`, `tests/e2e/planning.spec.ts`, test fixtures/harness files. Legacy browser expectations now assert the implemented FP-10 API's 401 denial and the existing fixed `reason=expired`, not nonexistent endpoints/obsolete reasons. Forged-cookie coverage uses the actual cookie name and rechecks the server after a forged client profile tries the workspace link; denial was not weakened.

## Baseline and checks

Before editing, build, typecheck and component tests passed on the preserved integration-fix working tree; lint had 92 errors and one warning. The baseline did not include successful agent/chat or connected-user journeys.

| Check | Result |
| --- | --- |
| Component/session suite | PASS, 73 tests including original suites and 14 new preference/goal/plan/asset/scenario/run/privacy tests |
| All backend tests | PASS, 14 tests in isolated generated fixtures, including prior accounts/session regressions and new frontend DTO/CD maturity coverage |
| Full Chromium suite | PASS, all 25 tests against the real protected server plus the separate labeled fixture harness |
| Typecheck | PASS |
| Production build | PASS, including all six protected task routes |
| Lint | 92 existing errors and one existing warning; baseline diagnostic comparison confirmed zero new findings. No suppressions or weakened checks. |
| `git diff --check` | PASS |

New tests cover explicit confirmations and exact API payloads; sample-source labels; missing providers; input preservation; returned receipt validation; duplicate submissions; same-key plan retry; 409 refetch/fresh confirmation; maturity and cash separation; server scenario inputs/evidence; empty scope; revocation; late user-A response after switching to user B; terminal polling, non-overlap and abort/unmount. Browser checks include focus containment/return, nested Escape behavior, readable scrollable tables, 1440/390px overflow and axe. Contrast and nested-dialog issues caught during verification were fixed, not suppressed.

## Actual Mailpit / Chromium rehearsals

The existing login-test database was opened read-only and backed up into an ignored isolated database. Only the test app process used a temporary `DATABASE_PATH` override. `.env.local`, OTP HMAC secret, NVIDIA settings, shared records and deployment/network files were not changed. Passwords, codes, cookies, mailbox bodies and session-state files were never printed or committed. Mailpit lookup retrieved only the new recipient-specific email for each attempt; no messages were deleted.

**Journey A — partially verified, blocked at institution OTP.** Real password submission and fresh Mailpit verification established a server-backed session. The new subscriptions page showed the real empty scope. The Institutions catalog loaded from the actual API; the generated simulator credential request reached the legacy preview handler. The frontend then stopped at **Institution email verification unavailable** and retained zero linked accounts. Connected subscriptions → preferences → offers → intention persistence/reload could not complete without bypassing missing institution verification, so none was manufactured. Offer wiring is an additional blocker.

**Journey B — goal work and calculations verified; linked planning blocked.** A different user completed real Mailpit login in the same browser context after logout. A user-A privacy-sentinel goal was absent, and direct access to its ID returned 404. User B created and edited a goal through actual POST/PATCH endpoints, then reloaded and observed persistence. Hypothetical baseline/extra-payment comparisons came from the real server calculator. Account-backed debt/assets/CD views and scenarios stayed empty/disabled because no institution was verified/linked. No existing plans were available; real plan acceptance/stale-plan interaction was therefore blocked. Fixture 409 regressions are not counted as real journey completion.

Both users logged out through the real 204 endpoint. Replaying each former cookie against `/me`, accounts, transactions, overview and forecast returned 401. The tests verified sessions and changes in the isolated database. The real run path returned 404; no model execution was claimed. User A/B source data was never mixed or stored in localStorage.

## Screenshots and evidence

FP-05/06/07 handoffs list each page's **labeled fixture** desktop/mobile screenshots. Additional fixtures here: [unlinked](evidence/unlinked-fixture-1280.png), [offers unavailable](evidence/offers-unavailable-fixture-1280.png). These demonstrate UI behavior, not backend readiness.

Actual local backend / Mailpit screenshots (synthetic database records, no network mocks):

- [Journey A subscriptions empty scope](evidence/journey-a-subscriptions-real-1440.png)
- [Institution OTP blocker](evidence/journey-a-institution-otp-blocked-real-1440.png)
- [Journey B persisted goal desktop](evidence/journey-b-goal-persisted-real-1440.png), [mobile](evidence/journey-b-goal-persisted-real-390.png)
- [Real server calculations](evidence/journey-b-server-calculations-real-1440.png)
- [Scenario dependency](evidence/journey-b-scenario-blocked-real-1440.png)
- [Run dependency](evidence/run-boundary-real-1440.png)
- [Anonymous login desktop](evidence/login-real-anonymous-1440.png), [mobile](evidence/login-real-anonymous-390.png)

## Readiness

| Task | Implemented | Verified against real backend | Blocked |
| --- | --- | --- | --- |
| FP-05 | Subscription/preferences/offer/intention UI and adapters | Real verified login/unlinked view; actual handler DTO/persistence regressions separately | Institution OTP, connected data, offer resolver, aggregates and action listing |
| FP-06 | Debt/calculation, goal edit, assets/maturity, scenarios, existing plans/409 UI | Real goal create/edit/reload, foreign-goal denial, hypothetical calculations | Verified linked debt/assets/scenarios and real server plan proposals |
| FP-07 | Nine roles, real-response polling/evidence and chat integration boundary | Actual missing-route response only | Run/chat HTTP wiring, provider execution and teammate integration; not fully complete |
| FP-08 | Protected navigation, state/privacy/a11y integration and responsive evidence | Real two-user partial journeys, logout and replay rejection | Both complete demo journeys await the dependencies above |

See [proposed combined PR title/body](PR_PROPOSAL.md). It uses **Related to #5, #6, #7, #8**, not automatic issue closure. No work on PR #45's dataset, a loan-offer agent, hosting, migration project, demo prelinking or registration is included.

After rehearsal, the isolated server was stopped and the normal local app was restored using the original `.env.local` on port 3000. A final comparison confirmed the entire environment file and every original database table record are unchanged. The rehearsal-only goals and authentication activity remain confined to the ignored isolated copy. No files are staged.
