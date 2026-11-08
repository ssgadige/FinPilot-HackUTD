# FP-03 implementation and integration handoff

Branch: `feat/fp-03-institution-catalog-and-simulated-linking`. Prepared for review with the integration blockers below. No merge, issue closure, seed reset, authentication bypass, or shared API-contract edit is included.

## Delivered frontend

- `/institutions` now has a dedicated server-gated page. It uses the shared FP-01 shell, headings, cards, buttons, fields, tables, badges and status components. The existing generic section route no longer generates this dedicated path.
- Five responsive category cards: Banks, Cards, Investments, Loans and Wallets. Provider names come from `GET /api/v1/institutions`, with category/search filtering and loading, empty, error and retry states. Tests verify PNC, Bank of America and Chase under Banks and representative providers in every other category. No fallback provider response ships in the application.
- Provider-specific native modal with keyboard containment, Escape/cancel behavior and focus restoration. The prominent warning is exactly: **“Simulation only. Do not enter real banking credentials.”** The form accepts generated demo email/usernames and passwords without hardcoding a successful credential.
- Both credential fields are reset **before** starting every submission, including missing-field/error paths. They are reset on cancel and cleared by unmount on provider change. FormData entries are deleted after extracting request arguments. No credentials are added to URLs, browser storage, logs, analytics, model calls or committed credential fixtures. Request arguments exist only for the same-origin request; this is not a claim of secure JavaScript heap erasure.
- A separate, accessible institution email verification step is prepared, with a labeled one-time-code field and verify/resend controls. All three remain disabled with an explicit unavailable state because the institution OTP wire contract is unconfirmed. It does not claim that a code was delivered. A masked recipient is displayed only when the server supplies one.
- Prepared post-verification `AccountConsent` component shows each eligible masked account and its exact record/date scope. No account or consent checkbox is preselected. It requires a supplied consent version and verified-preview metadata; it does not assume a fixed history length or expose balances before consent.
- Prepared `ConnectionManager` renders only a supplied confirmed connection/receipt, known server sync time, request-in-progress state, failure/retry, reconnect entry and explicit disconnect confirmation. It never invents progress percentages, sync steps, a new successful-sync timestamp, or a connection listing.
- Link and sync submissions block duplicates. Link scope freezes after its first attempt; retry uses the same selected accounts, preview token, consent version and idempotency key. A changed preview starts a new consent intent with no selections. Sync retains its key on failure and creates a new key only after a confirmed success.
- Disconnect waits for HTTP 204. It then clears displayed account state and snapshot information, emits `finpilot:finance-invalidated`, requests fresh `GET /accounts` and `GET /overview` with `cache: no-store`, and refreshes the server route tree. Old disconnected labels are not reintroduced even if refresh fails or a stale refresh response contains them. This branch has no other live financial client cache; future consumers must honor invalidation and server ownership checks. Failed revocation keeps the prior confirmed connection and does not claim a disconnect.
- Generic invalid-login, expired-preview, unauthorized, rate-limit/Retry-After, network, missing-CSRF, unavailable-service and unsupported-response states. Arbitrary backend error messages are not reflected into the UI. React renders provider names and scope text as untrusted text, never executable HTML or instructions.

## FP-10 protections remain intact

`src/server/auth/session.ts` is unchanged. The workspace layout still calls its deny-all `requireVerifiedSession()`, and the new institutions page independently calls it before rendering the catalog. The real `/institutions` page redirects to `/login?reason=unavailable`; there is no production preview route, environment flag, test identity, or client-only substitute for server authentication.

FP-10 still needs to supply the real verified-session validator, secure cookies, CSRF/origin protection and authentication endpoints. Backend ownership and scoped financial API access are not implemented by this frontend task. No real authenticated linking journey is claimed.

## Institution OTP blocker and PR #26

Reviewed [PR #26](https://github.com/ssgadige/FinPilot-HackUTD/pull/26), including its FP-11 verification requirements. Its seeded-login details are not copied into frontend code. It requires an institution-link challenge bound to session user, provider, recipient and attempt, with a fresh code before a preview token or account labels are released. App-login codes must not be interchangeable with institution codes.

The current API contract still documents legacy `POST /connections/preview` credentials → preview behavior and contains no institution verify/resend paths. This implementation calls only that documented path for the credential request, then **stops at an unavailable verification step**. The adapter deliberately discards any legacy account labels or preview token in its response. Even a test backend returning a legacy successful preview cannot expose account selection or issue a link request through the catalog.

`VerifiedInstitutionPreview` is an internal post-verification view model, **not an agreed wire schema**. No production adapter creates it. Likewise, post-verification consent and connection-management components are tested in isolation; the catalog cannot reach them until FP-11 supplies and agrees the OTP integration. No successful OTP response, verify URL or resend URL is invented.

## Missing backend contracts and coordination checklist

Inspection found no `src/app/api/v1` handlers or `src/server/simulator` implementation on this branch. FP-11 must implement and verify the documented routes before integration:

| Route | Frontend behavior / remaining agreement |
| --- | --- |
| `GET /institutions` | Strict provisional decoder accepts an array of `{id,name,category}`, with categories matching the existing seed. Confirm the response envelope with FP-11; malformed/duplicate provider data fails visibly. |
| `POST /connections/preview` | Sends only documented `{institution_id,demo_username,demo_password}`. Never releases an account preview. Confirm the new challenge-start response and its relationship to this legacy path. |
| Institution verify/resend | **No paths or working adapter exist.** Agree start/verify/resend methods, payloads, masked recipient, attempt/expiry/cooldown metadata, errors, pending-cookie binding and CSRF delivery. Only verified success may construct the post-OTP view model. |
| `POST /connections` | Sends `{preview_token,account_ids,consent_version,idempotency_key}`. Isolated provisional decoder requires `connection: {id,institution_id,status:'active',account_ids,last_sync_at?}` with exactly the requested account IDs. This shape needs FP-11 confirmation. A mismatch cannot produce a connected UI. |
| `POST /connections/:id/sync` | Sends `{idempotency_key}`. Requires the documented integer `snapshot_version` result. Does not infer completion timestamps or fabricate polling/events endpoints. |
| `DELETE /connections/:id` | Sends `{confirmation:true}` and requires 204. Confirm this success status with FP-11; other responses do not claim revocation. |
| `GET /accounts` | Used only to request fresh authorized data after confirmed disconnect. The JSON response is opaque and not interpreted as a connection list. |
| `GET /overview` | Documented refresh request after confirmed disconnect. No stale financial aggregate is displayed when it fails. |

**No connection-list/status API is confirmed.** There is no documented `GET /connections`; it is not called or implemented here. The catalog therefore reports connection status and last sync as unavailable, rather than inferring them from a provider tile, empty accounts result, or remembered credentials. Persisted connections, revoked/partial states and current server progress require an agreed listing/status source. Prepared management views can receive confirmed data once that source exists.

Other remaining coordination:

1. FP-10/FP-11 must confirm the session-bound CSRF transport. The adapter reuses FP-02's unconfirmed `X-CSRF-Token` mechanism from `GET /me`; mutations are not sent if that token is missing.
2. Confirm invalid-login/expired-preview machine codes and `Retry-After` behavior. No raw provider error is trusted. The frontend currently recognizes `INVALID_CREDENTIALS`/`INVALID_INSTITUTION_LOGIN`, `PREVIEW_EXPIRED`/`INVALID_PREVIEW`/410, 401/403 and 429; other errors remain generic/unavailable.
3. FP-11 must supply the verified preview's exact account labels, masked identifiers, record scope/dates, expiry and consent version. The frontend does not assume the PDF's sample balances or uniform thirty-month history.
4. Ownership checks, challenge-purpose binding, one-time preview consumption, database deduplication, disconnected-history isolation and idempotency persistence belong to FP-11. Frontend tests do not prove them.
5. Retry keys are retained in memory for the current link/sync intent and never stored with preview tokens or credentials. Reload/abandoned-operation recovery requires the missing connection-status contract and server persistence; no cross-reload exactly-once guarantee is claimed.
6. Reconnect explicitly returns to provider sign-in and required institution verification; it cannot reuse revoked consent. A real reconnect/deduplication journey remains blocked until FP-11 integration.

## Visual reference and fixture evidence

Reviewed the attached `FinPilot_All_Screens_and_Task_Guide.pdf`, pages 10–17: handoff, category/provider discovery, simulated login, account consent, confirmed connection, sync and failure states. All text, inputs, buttons and tables are semantic React/HTML components. No PDF page is embedded in the app.

All FP-03 screenshots below are **automated-test fixtures, not live integration**. They render in a separate loopback-only Vite harness under `tests/browser`, with an explicit fixture banner; dialog captures are also labeled. Session and network fixtures exist only in tests. The harness is not imported by the Next.js application, is absent from its production routes, and never modifies the real server guard. Vite is pinned as a development dependency because it was already part of the Vitest tooling. The harness has no backend or simulator service and only exists during browser QA.

- [Catalog desktop, 1440px](evidence/catalog-fixture-1440.png)
- [Catalog mobile, 390px](evidence/catalog-fixture-390.png)
- [Simulated provider login, mobile](evidence/simulator-login-fixture-390.png)
- [Institution verification unavailable, mobile](evidence/institution-verification-unavailable-fixture-390.png)
- [Consent desktop, 1440px](evidence/consent-fixture-1440.png)
- [Consent mobile, 390px](evidence/consent-fixture-390.png)
- [Sync failure, mobile](evidence/sync-failure-fixture-390.png)
- [Confirmed disconnect and failed refresh, mobile](evidence/disconnected-fixture-390.png)

Visually reviewed category/provider layout, warning visibility, form readability, consent scope, modal behavior and disconnected-data removal. Browser tests scan the catalog, provider dialog, verification-unavailable step, consent and disconnect confirmation with axe; automated scans do not replace screen-reader review.

## Changed files

| Files | Purpose |
| --- | --- |
| `src/app/(workspace)/institutions/page.tsx` | Dedicated server-gated route |
| `src/app/(workspace)/[section]/page.tsx` | Exclude the dedicated route from generic static params |
| `src/lib/connections-api.ts` | Same-origin typed operations, safe error mapping and isolated provisional response decoders |
| `src/components/connections/*` | Catalog, modal credential form, blocked institution verification, prepared consent and confirmed connection lifecycle |
| `src/components/app-shell.tsx` | Remove the blanket “no institutions connected” claim; retain the simulation label |
| `tests/ui/connections.test.tsx` | Component/API interaction checks |
| `tests/fixtures/institutions.ts` | Public provider names and synthetic post-verification labels; no passwords or OTPs |
| `tests/browser/*`, `tests/e2e/connections.spec.ts` | Isolated session/network fixtures and browser evidence |
| `playwright.config.ts`, `package.json`, `package-lock.json` | Launch and pin the development-only harness alongside existing real-server tests |
| This file and `evidence/*.png` | Integration handoff and labeled visual evidence |

Existing planning files, FP-02 authentication code, the server deny-all helper, shared contracts and API documentation remain unchanged.

## Checks

Run `npm ci`, then `npm run dev`. The real `/institutions` route remains blocked while FP-10 is missing. `npm run test:e2e` launches both the real Next.js server (port 3000) for denial/auth regression tests and the isolated test harness (port 3100) for component rendering with test-only network fixtures. Do not treat the harness as an application preview or deploy it.

Review of `playwright.config.ts` confirms that the original Next.js server, default port-3000 base URL, test directory, concurrency setting and failure-trace policy are retained. The only addition is the loopback test harness server. Only the new FP-03 browser test file opts into port 3100; existing FP-02 and real server-denial tests are unchanged. No tests are skipped, filtered out or redirected to the harness, and the new FP-03 suite also checks that the real `/institutions` route remains denied.

Verified on Windows with Node 24.22.0; the repository's baseline remains Node 22.13+.

| Check | Result |
| --- | --- |
| `npm run build` | Pass; dedicated institutions route builds and stays server-gated |
| `npm run lint` | Pass, zero warnings |
| `npm run typecheck` | Pass |
| `npm test` | 30 tests pass, including 14 new FP-03 cases |
| `npm run test:e2e` | 11 tests pass, including 4 new FP-03 scenarios |
| `git diff --check` | Pass |

Component tests cover category/search discovery, pending/empty/error directory states, invalid login and immediate secret clearing, cancel/provider change, legacy-preview non-disclosure, unconfirmed verification controls, unauthorized/rate-limit/expired-preview errors, network/CSRF failures, consent and exact account selection, duplicate submissions, stable link/sync retry keys, preview replacement/expiry, unexpected linked account rejection, sync failures and confirmed disconnect invalidation/refresh.

Browser tests preserve the real server-denial checks (including JavaScript-disabled access and forged cookies) and test fixture catalog, dialog keyboard/focus behavior, blocked OTP step, consent, sync retry and disconnect refresh. The production server gate is never mocked. Prior FP-02 screenshots regenerated by the full suite are restored to their original committed bytes so this task does not change historical evidence.

Acceptance remains limited by the integration blockers above: these tests demonstrate frontend behavior and fail-closed routing, not a working bank connection, email delivery, server ownership enforcement or database deduplication.
