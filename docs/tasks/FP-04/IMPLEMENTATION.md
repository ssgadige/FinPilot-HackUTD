# FP-04 implementation and integration handoff

Branch: `feat/fp-04-overview-transactions-and-cash-calendar`.

The frontend is prepared for review. **End-to-end financial access remains blocked by FP-10 and FP-12.** The real application continues to deny access to every financial page. No authentication bypass, backend implementation, shared API-contract edit, runtime fixture fallback, merge or issue closure is included.

## Delivered screens

- **Overview:** backend-reported liquid cash, total debt and net worth; a separate investments/restricted-assets card; three explained indicators; upcoming bills; account evidence; and a separately loaded forecast. A forecast failure does not replace available overview totals. Missing/null amounts remain unavailable, including investment totals. No balance or summary is calculated from transaction pages.
- **Accounts:** masked identifiers, account kind, individual reported balances, last successful sync when supplied, scoped evidence and links to filtered history. Investment/retirement/CD balances are explained separately from spendable cash. No account-detail endpoint is invented.
- **Transactions:** search, account/category/from/to filters, opaque cursor navigation with previous-page history, filter preservation while paging and cursor reset on every filter change. The initial request has no date restriction. Tests exercise an older record from a 30-month history and a shorter one-page history; neither history length nor a start date is hardcoded in runtime code. There is no synthetic month filling.
- **Cash & bills:** documented `days=30|90` requests; a dated SVG forecast with proportional date spacing and USD/date labels; a keyboard-accessible table alternative; projected commitments; account scope, low-cash explanation and assumptions. Only returned dates/amounts are plotted. Chart coordinate scaling and cents formatting are presentation operations, not financial calculations.
- **Evidence drawer:** source account/transaction fields already returned by scoped APIs, with a fresh `GET /accounts` access check before displaying the selected record. Loading, unavailable/retry and revoked/disconnected states; native modal semantics, explicit Tab/Shift+Tab containment, Escape, visible focus and opener-focus restoration. Scope invalidation removes the drawer and its records. Account links from bills open account evidence; related-history links filter by the documented `account_id`, rather than inventing transaction-detail lookup semantics.

The shared FP-01 shell, headings, cards, buttons, form fields, tables, chart wrapper, focus styling and responsive navigation are reused. Routes independently call `requireVerifiedSession()`; the existing workspace layout still calls it too. The root scaffold's hardcoded example dashboard was replaced with a guarded redirect to `/overview`. Generic section generation excludes the four dedicated routes.

## Source, calculation and classification integrity

Read the task handoffs, API/security/UI guidance and shared contracts before implementation. Visually reviewed PDF pages 18–24 and calculator pages 74–77. All product text, controls, tables and charts are semantic React/HTML/SVG; no PDF page or reference balance is embedded in the application.

The PDF/product definitions are displayed as explanations, while results remain backend-authoritative:

| Indicator        | Definition / handling                                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cash buffer      | Liquid cash / essential monthly spending, in months. Investment/retirement/CD cash is excluded by default. Missing or zero spending makes the indicator unavailable. Negative reported results remain negative. |
| Debt-to-income   | Required monthly debt payments / gross monthly income × 100. Optional extra payments are excluded. The service must disclose whether income is observed or assumed. Missing/zero income is unavailable.         |
| Card utilization | Eligible revolving card balances / known card limits × 100. Missing limits make the result incomplete/unavailable. Reported values are not capped at 100%.                                                      |

Values are shown only with a matching explicit unit, finite result, integer-cent numerator, positive integer-cent denominator and no reported missing inputs. The frontend does not calculate the ratio, invent thresholds, assign healthy status, predict a credit score or present loan approval. Missing calculation explanations, assumptions, source mode, freshness and missing-input reporting have explicit unavailable/not-supplied text. `fixture` and `cached` sources are labeled accordingly; cached results are never relabeled live. Snapshot versions and as-of metadata remain visible.

Transactions show backend classification (`charge`, `income`, `transfer`, `payment`) and `posted`/`pending` status, plus the account kind and signed USD balance change. Absent classification/status is explicitly unclassified/unreported. A positive liability delta is never inferred to be income. Transfers remain visible in history. Owned-transfer exclusions, summary reconciliation and avoiding card-purchase/repayment double counting are **FP-12 tool duties**, not sums of the currently displayed page.

## Authentication and state revocation

`src/server/auth/session.ts`, the workspace layout, FP-02 authentication code and FP-03 connection code are unchanged. The real helper still redirects everyone to `/login?reason=unavailable` until FP-10 supplies trusted validation. No environment flag, forged-cookie check, client-provided identity, public preview route or alternate server authentication helper was added.

`FinanceScope` is a client UX/data-lifetime boundary, **not authorization**. It waits for confirmed client session state and a complete authorized accounts response before mounting financial children. Reads use same-origin server-managed cookies, `cache: no-store`, redirect rejection and a 15-second timeout. No password, OTP, session token or financial cache is written to storage. Backend strings are rendered as text; arbitrary backend error messages are not reflected into the UI.

Each financial result must match the authorized accounts snapshot. Transaction/bill/forecast account IDs must be in that scope. HTTP 401 clears the client session and financial children; 403, 409, missing selected-account access and changed snapshots clear financial children and require a fresh scope. A network/service/unsupported-schema error provides a retry without substituting records. Empty accounts link to Institutions; connected accounts with no records and filtered empty results have distinct messages.

The existing FP-03 `finpilot:finance-invalidated` event immediately discards the scope and unmounts all financial views/drawers, then requests fresh accounts. FP-03 already requests fresh accounts/overview after confirmed disconnect. New section data loads only after fresh scope confirmation. Aborts, monotonically increasing scope generations and request-key rendering prevent older responses from restoring disconnected data or replacing a newer search. Scope and page data are held only in component memory and are discarded on unmount/session loss.

## FP-10 / FP-12 integration blockers

Inspection found **no `src/app/api/v1` finance or authentication handlers** and only a tools README under `src/server/tools`. Browser checks confirm that `/me`, `/accounts`, `/transactions`, `/overview` and `/forecast?days=30` return 404 on the actual Next server. There is no claim of live backend integration, server ownership enforcement or full-ledger reconciliation from these frontend tests.

1. **FP-10:** supply a trusted verified-session validator, secure server-managed cookies, expiration/revocation enforcement and the authentication endpoints. Preserve server enforcement on every financial page and API. CSRF/origin protection and the session-validation transport remain integration blockers; this task adds only GET adapters and does not introduce mutation/CSRF alternatives.
2. **FP-12:** implement the four documented GET endpoints, user-scoped ownership and disconnected-history exclusion; verify transfer pairing, card-payment treatment, full available history and deterministic aggregates against the ledger. Confirm cursor stability and snapshot consistency under sync/disconnect. These properties are not proven by mocked frontend tests.
3. **FP-12 response agreement:** the API documents transaction query parameters and `Page<T>`, overview's basic totals/indicators/bills/snapshot fields, and forecast concepts, but does not define complete Account/Transaction/Forecast schemas, investment totals, indicator inputs/units, per-response source/as-of metadata or cross-response snapshot behavior. `contracts/types.ts` has no financial record definitions. Shared contracts were preserved. The local types/decoders in `src/lib/finance-api.ts` are **proposals needing FP-12 agreement**, not claims that those fields already exist. No external coordination message or contract acceptance is claimed.

| Documented route            | Isolated provisional response model / agreement needed                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /accounts`             | `{items: Account[], snapshot_version, ...metadata}` with a complete authorized scope; non-null account pagination is rejected instead of treating a partial page as the complete whitelist. Account fields: `id,label,kind`, optional masked `last_four`, integer/null `balance_cents`, `last_sync_at`. Account kinds match the existing data/schema.sql enum: checking, savings, credit_card, brokerage, ira, cd, auto_loan and mortgage. Confirm the API envelope, field mapping and completeness with FP-12. |
| `GET /transactions`         | Shared `Page<Transaction>` plus snapshot/metadata. Record fields: `id,account_id,date,description,amount_cents`, optional category/classification/status. Confirm naming, ordering, history bounds, transfer/payment classification and pending semantics. Only documented `q,account_id,category,from,to,cursor` filters are sent.                                                                                                                                                                             |
| `GET /overview`             | Documented integer/null totals and snapshot, optional `investments_cents`, indicators and bills. Proposed indicator keys: documented `cash_buffer_months`, plus unconfirmed `debt_to_income` and `card_utilization`; proposed `unit,numerator_cents,denominator_cents,missing_inputs`. Confirm percent-vs-ratio units, denominator periods, assumed-income disclosure, aggregate account scope and partial-limit handling. Missing investment total is unavailable, never inferred.                             |
| `GET /forecast?days=30\|90` | Proposed `account_ids`, chronological unique `balances:[{date,balance_cents}]`, projected `events`, `low_cash_date`, optional `low_cash_explanation` plus metadata. Confirm actual field names, included-account evidence, low-cash threshold, scheduled-item ordering and assumptions. Empty forecast points remain empty; dates are not fabricated.                                                                                                                                                           |

Common proposed metadata is `snapshot_version`, optional `source_mode,as_of,assumptions,missing_inputs`. Snapshot identity is required before accepting financial responses; missing/incompatible schemas show an explicit FP-12 integration-unavailable message. Unsupported existing overview example indicators without calculation inputs do not produce a supposedly healthy value.

There is **no new account-detail, transaction-detail, connection-list or forecast-event endpoint**. Drawer evidence is limited to list records already returned at the confirmed snapshot and a new accounts access check; it cannot independently refetch an exact transaction by ID or expose deeper calculation evidence that the current contract does not specify. FP-12 must agree any richer lookup/evidence contract before adding that capability. Changing snapshot triggers a full clear/refresh rather than combining evidence from different snapshots.

## Validation

| Check                   | Result                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `npm.cmd run lint`      | PASS, zero warnings                                                                            |
| `npm.cmd run typecheck` | PASS                                                                                           |
| `npm.cmd test`          | PASS, 51 tests across 4 files; 21 FP-04 tests                                                  |
| `npm.cmd run test:e2e`  | PASS, 16 Chromium tests, including prior FP-02/FP-03 regressions and 5 new FP-04 browser tests |
| `npm.cmd run build`     | PASS; dedicated dynamic routes generated; no test-harness application route                    |
| `git diff --check`      | PASS                                                                                           |

FP-04 component coverage includes every filter and cursor reset/preservation, 30-month/shorter histories, ignored-abort stale search protection, investment separation, missing/null values and zero denominators, backend totals independent of transaction history, account-kind/type/pending display, empty/no-match states, network/rate-limit/schema failures and retry, pending session privacy, 401/403/409 clearing, snapshot mismatch, evidence access failures/retry, revoked/unknown accounts, disconnect invalidation, late responses after revocation, and Escape/focus restoration. Browser coverage adds real native keyboard containment and responsive/no-page-overflow checks. Axe scans of overview, transactions, cash forecast and evidence report zero violations. Automated accessibility checks do not replace manual assistive-technology review.

An initial browser run exposed a real single-control dialog Shift+Tab escape, which was fixed with explicit containment. A later isolated failure was traced to Chromium `ERR_NETWORK_CHANGED` loading a Vite dependency; its focused rerun and the full suite passed. No test expectations or authentication guards were relaxed. `playwright.config.ts` is unchanged; only the existing server-denial test was extended to check all four financial endpoints.

## Labeled screenshots

All screenshots are **automated test fixtures, not live integration**. The existing loopback-only Vite harness was extended under `tests/browser`; session/network fixtures are confined to automated tests. The harness is not imported by the Next application and never replaces its server guard. Every page capture has a visible fixture banner; drawer captures also have a test-only label. Screenshots have been visually reviewed against the PDF and shared FP-01–FP-03 visual system.

| Screen          | Desktop                                                   | Mobile                                                  |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Overview        | [1440px fixture](evidence/overview-fixture-1440.png)      | [390px fixture](evidence/overview-fixture-390.png)      |
| Accounts        | [1440px fixture](evidence/accounts-fixture-1440.png)      | [390px fixture](evidence/accounts-fixture-390.png)      |
| Transactions    | [1440px fixture](evidence/transactions-fixture-1440.png)  | [390px fixture](evidence/transactions-fixture-390.png)  |
| Cash calendar   | [1440px fixture](evidence/cash-calendar-fixture-1440.png) | [390px fixture](evidence/cash-calendar-fixture-390.png) |
| Evidence drawer | [1440px fixture](evidence/evidence-fixture-1440.png)      | [390px fixture](evidence/evidence-fixture-390.png)      |

Additional states: [disconnected fixture](evidence/disconnected-fixture-1280.png), [unavailable-service fixture](evidence/unavailable-fixture-1280.png).

## Changed files

| Files                                                                                                                          | Purpose                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/app/(workspace)/{overview,accounts,transactions,cash-and-bills}/page.tsx`                                                 | Dedicated independently server-gated financial pages                                                           |
| `src/app/(workspace)/page.tsx`, `[section]/page.tsx`                                                                           | Guarded root redirect and exclusion of dedicated sections                                                      |
| `src/lib/finance-api.ts`                                                                                                       | Typed GET adapter, strict provisional decoders, shared Page/SourceMode types, safe errors and cents formatting |
| `src/components/finance/{finance-scope,finance-ui,evidence-drawer,overview,accounts,transactions,forecast}.tsx`, `finance.css` | Scope lifecycle, four screens, evidence, metadata, forecast and responsive styles                              |
| `tests/fixtures/finance.ts`, `tests/ui/finance.test.tsx`, `tests/e2e/finance.spec.ts`                                          | Test-only synthetic responses and meaningful behavioral/browser checks                                         |
| `tests/browser/{main.tsx,next-navigation.ts,fixture.css}`                                                                      | Existing isolated harness modes/navigation and fixture labels                                                  |
| `tests/e2e/scaffold.spec.ts`                                                                                                   | Preserve real fail-closed checks and confirm missing finance endpoints                                         |
| This handoff and `evidence/*.png`                                                                                              | Integration blockers, acceptance evidence and labeled screenshots                                              |

No dependencies or lockfile changes were needed. Existing planning files, shared API/security/type contracts, prior screenshot evidence and unrelated feature implementations are preserved. Generated `.next`, test results, PDF renderings and formatter caches are not deliverables. This handoff accompanies the FP-04 review commit. Publishing the task branch does not complete backend integration; merging and closing issue #4 remain outside this handoff.
