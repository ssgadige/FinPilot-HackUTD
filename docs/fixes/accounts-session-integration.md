# Accounts snapshot and session-redirect integration fix

Branch: `fix/accounts-snapshot-and-session-redirect`, created from current local `main` at `56203bb`. Changes are uncommitted and have not been pushed or merged.

This fixes the two integration failures found in the real local Mailpit login test. It does not prelink the ten demo users, create an eleventh user, add registration, alter institution verification/consent, fabricate balances, or reset any existing database.

## Accounts agreement between FP-04 and FP-12

The authenticated `GET /api/v1/accounts` response now implements the shared `AccountsResponse`/`AccountSummary` types in `contracts/types.ts`; the FP-04 adapter reuses them. `docs/API.md` records the response fields and semantics.

- `snapshot_version` comes from `store.user(uid).snapshot_version`, using the identity from the validated server session. It is included for linked, filtered, unmatched and empty lists. It is neither hardcoded nor inferred from an account row.
- The list and snapshot are read inside one database transaction so concurrent scope changes cannot combine different snapshots in one response. Existing ownership and active-connection filtering remain in force.
- `source_mode` explicitly identifies the simulated financial records as `fixture`; `as_of` is the existing dataset observation date. These are not claims of live bank data or a new sync.
- Unknown `last_sync_at` values are omitted instead of returning `null` to a decoder expecting an optional timestamp. No successful sync time is invented.
- The frontend snapshot validation and cross-response consistency checks are retained. No sample response, zero-balance fallback, authentication bypass or institution-link bypass was added.

Other post-link financial response differences remain outside this focused fix: transaction field names/metadata, overview indicator keys and basis-point units/calculation inputs, upcoming-bill fields, and forecast envelope/evidence fields still need their own FP-04/FP-12 agreement. This empty-scope login result does not claim that every populated financial screen is integrated.

## Session redirects and cross-bundle errors

The login page recognizes `reason=expired`, while the session gate previously emitted `reason=session-expired`. Missing, expired and revoked sessions now redirect to `/login?reason=expired`; configuration, service and unrelated errors still redirect to `/login?reason=unavailable`. All failures continue to deny financial-page access.

There was a second classification problem: `getServices()` caches services on `globalThis`, while Next.js can compile page and API modules separately. A service created by one bundle can throw an `ApiFailure` that fails an `instanceof ApiFailure` check in another bundle. Errors now carry a server-created `Symbol.for('finpilot.ApiFailure')` brand, recognized through `isApiFailure`. Both the page gate and API error handler use it. Only the typed `401/unauthenticated` session failure selects the expired message; an unbranded object with similar fields does not. This changes error classification, never the decision to grant access.

The real application was restarted after the code change to reload its service instances. The tested production build is running at `http://127.0.0.1:3000`, with logs in the OS temporary directory. Mailpit remains at `http://localhost:8025` with SMTP on loopback port 1025.

## Automated regressions

- `tests/backend/accounts-contract.test.ts`: real isolated backend responses for empty, linked, institution-filtered, unmatched and revoked scopes; distinct database snapshots for two users; snapshot changes after linking/revocation; source/as-of metadata; omitted unknown sync time; anonymous denial. Responses also pass through the real frontend decoder. Linking here occurs only in newly generated temporary test fixtures, never the existing demo database.
- `tests/ui/session-gate.test.tsx`: verified profile only after server session validation; missing-cookie denial; an actual separately loaded error constructor to reproduce the cross-bundle case; API handling of that same failure; distinct configuration/service/unrelated/unbranded-error denial paths. The module mocks exist only in this automated unit test.

| Check | Result |
| --- | --- |
| All backend tests (`tsx --test`, TAP reporting) | **PASS: 13 tests**, including the new accounts regression and existing authentication, ownership, simulator, finance, planning and SMTP regressions |
| `npm.cmd test` | **PASS: 59 tests**, including 8 session-gate cases |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run build` | **PASS**, including the real API catch-all and protected financial routes |
| `npm.cmd run lint` | Existing repository failure: **92 errors and 1 warning**. Comparing diagnostics with `main` found **zero new findings**; existing findings were not suppressed or expanded into unrelated fixes. |
| `git diff --check` | **PASS** |

The legacy mocked browser suite was not used as evidence of backend integration. The following checks used the real production application and real Mailpit delivery.

## Real Chromium + Mailpit verification

One fresh successful end-to-end attempt was run against the production build with the existing Maya account and generated local demo credential. Mailpit message IDs were captured before submission; only the newly delivered message for that recipient and attempt was retrieved. Its code remained in memory. No passwords, codes, session cookies, full email bodies, browser traces or browser session-state files were printed or committed. There was no network mocking, route interception, session fixture or authentication bypass in this run.

| Check | Result |
| --- | --- |
| Password submission in Chromium | **PASS**, real backend returned 202 |
| New email delivered to the exact Maya recipient through Mailpit | **PASS** |
| Pending challenge cannot access `/me` or financial APIs | **PASS**, 401; no authenticated session cookie before verification |
| Email-code submission in Chromium | **PASS**, real backend returned 200 |
| `/me`, profile, session record and CSRF availability | **PASS**, real server-backed authenticated session |
| Accounts snapshot equals Maya's database snapshot | **PASS**, response carries the actual value and source/as-of metadata |
| Overview, Accounts, Transactions and Cash & bills | **PASS**, helpful **No connected accounts** state, Institutions link, no schema error or fabricated balance |
| Disconnected records | **PASS**, absent from returned accounts/history and browser workspace; explicit disconnected-account transaction filter returned 404 |
| Sign out in Chromium | **PASS**, real logout returned 204; session record was removed |
| Former-cookie replay against `/me`, `/accounts`, `/transactions`, `/overview`, `/forecast?days=30` | **PASS**, all returned 401 |
| Former-cookie replay against all four financial pages | **PASS**, server denial and browser redirect to `/login?reason=expired`; recognized **Your session has expired** message visible |

Screenshots show the **real local browser run with synthetic records and no linked accounts**, not mocked integration or live banking:

- [Desktop, 1440px](evidence/no-connected-accounts-real-mailpit-1440.png)
- [Mobile, 390px](evidence/no-connected-accounts-real-mailpit-390.png)

## Preservation and review scope

The local `.env.local` file is unchanged, including the OTP HMAC secret and NVIDIA configuration. The existing login-test database was not reset, regenerated, prelinked or manually edited; normal login/logout creates and revokes authentication records. Hash checks verify that existing users, accounts, transactions, connection scope and scheduled financial records are unchanged. Configuration, generated databases, credential files and sanitized local test-run outputs remain gitignored. No secrets or mailbox messages are part of this change.

Review files: shared account types and API documentation; the FP-04 account type imports; FP-12 account response and unknown-sync normalization; stable server error recognition and the session gate; the two focused regression files; this handoff and two workspace screenshots. No registration, user-seeding, institution-verification or local-configuration source changes are included. Nothing is staged, committed, pushed or merged.
