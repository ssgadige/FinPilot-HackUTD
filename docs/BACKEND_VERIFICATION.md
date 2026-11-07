# Backend verification — FP-09 through FP-16

Work is on `tasks-9-16`. Frontend development is paused pending Figma. Contract v1 is preserved; GET `/evidence/:id` is an additive scoped retrieval endpoint. Database migrations live in the adapter and preserve the supplied seed/schema. Setup creates local secrets and credentials outside version control.

| Task | Implementation and evidence | Remaining dependency |
|---|---|---|
| FP-09 | SQLite transactions/migrations, scoped queries, reconciled 10-user / 30-month seed, repeatable setup | None for backend scope |
| FP-10 | scrypt, HMAC OTP, bound pending cookie, expiry/replay/attempt limits, resend, SMTP, hashed sessions, CSRF/origin, logout | Live Mailpit demonstration outside tests |
| FP-11 | Owned simulator credentials, preview token, selected consent, link/sync replay, revoke | None for backend scope |
| FP-12 | Scoped ledger filters/cursors, masked projections, account-kind totals, fixture-date overview/forecast | Frontend consumption deferred |
| FP-13 | Integer-cent forecasting/stress, monthly amortization, utilization, recurring normalization, stable calculation IDs | Full offer comparison belongs to lane C |
| FP-14 | Goals/preferences, planned intentions, proposals, atomic version acceptance, stale snapshots | Evidence-gated runtime must supply real proposals |
| FP-15 | Authenticated run/chat/event APIs, budgets, cancellation/timeout, idempotent expense/delay, repair enqueue, persisted status/results | Real lane-C specialist DAG and offer adapter are not installed; default runs fail explicitly |
| FP-16 | Automated backend/security checks, production build, dependency audit, isolated SMTP/provider tests, setup/reset/container instructions | Live Nemotron tool-call smoke, complete lane-C E2E and Docker persistence demonstration remain unverified |

## Automated evidence

`npm test` covers 22 integration/calculation/provider cases. Coverage includes wrong passwords, unknown users, wrong/expired/replayed OTPs, pending-login isolation, binding, cooldown, attempt/rate limits, idle/absolute expiry, delivery failure, logout, Origin and CSRF, selected-account visibility, foreign read/mutation IDs, ledger reconciliation and pagination, known interest/payoff cases, invalid dates/ranges, zero income, transfer exclusion, confirmation/version races, idempotent link/sync/events, stale/disconnected evidence, cancellation/timeouts/budgets, runtime schema validation, chat ownership, inert malicious merchant strings, real SMTP protocol delivery to an isolated local test server, fixed-provider redirect policy, oversized/malformed/error responses and honest missing credentials.

Tests use a deliberately fake runner/provider only where marked in test source. They do not prove real specialist inference, agent dependency execution, live offers or a real NVIDIA tool round trip. Uninstalled offer integrations fail before any outbound fetch; full offer SSRF policy verification awaits that adapter. No real transfer, purchase or subscription cancellation is implemented.

`npm run typecheck` and `npm run build` pass. The 5 Python seed tests also pass. Two consecutive `npm run setup` executions preserved the existing database and applied migrations idempotently; fresh seed validation reported 10 users, 41 accounts and 12,062 reconciled transactions. A production HTTP smoke test confirmed that `/me`, `/accounts` and `/overview` return 401 without a session. Configured server secret values were absent from `.next/static`, and git ignores generated env/database/credential files. `docker compose config --quiet` passes. `npm audit` reports zero known vulnerabilities after upgrading Nodemailer. Python's seed suite validates reconciliation, password separation and composite ownership independently. Generated data and secrets are ignored by git; only server route modules import auth/provider code. No provider payloads, passwords, OTPs or tool arguments are emitted to application logs.

## Operational limitations

The runner is in-process, designed for one application instance. A restart marks interrupted runs failed; it does not pretend they completed. Raw run results and plan payloads are withheld when their snapshot is stale; evidence access rechecks snapshot and account ownership. Accepted plans persist through failed revisions; revoking data marks them stale. Forecasts include only known schedules, so incomplete schedules can overstate capacity. All financial data remains `fixture` even when chat inference is live.

Docker verification could not run because the local daemon was not running. Container image/volume checks, real Mailpit demo login, and live NVIDIA model/tool checks must be recorded before marking all FP-15/16 acceptance conditions complete. No GitHub issues have been closed or remote branches pushed.
