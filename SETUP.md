# Local installation and verification

Use Node 22.18+ (the repository pins Node 22 in `.nvmrc`), npm and Python 3.11+. SQLite is built into Node; no separate database server or Python virtual environment is required for this application.

## Start the application

From the repository root:

```sh
npm ci
npm run setup
docker compose up -d mailpit
npm run dev
```

Setup generates the private synthetic database only when absent, applies migrations and automatically prepares all ten demo dashboards (seven account types each). Repeating ordinary setup preserves existing records and revoked connection choices. To explicitly upgrade an older demo database, run `npm run demo:prepare`; it creates a consistent backup before adding the missing presentation records/access. It creates an ignored `.env.local` with a random OTP secret if needed, without overwriting existing configuration. Configure the server using `.env.example`; do not commit or paste actual values. Generated defaults do not set empty NVIDIA values that would mask existing `.env` configuration. If an older `.env.local` contains empty NVIDIA entries, remove those entries or configure them there: Next.js gives `.env.local` priority over `.env`.

Open http://127.0.0.1:3000/login. Use the exact `APP_URL` if you have customized it: `localhost` and `127.0.0.1` are different origins, and unsafe requests from another origin are correctly rejected. Use only the generated fictional application credentials in `data/demo-credentials.json`. Start the local inbox separately:

```sh
docker compose up -d mailpit
```

Mailpit is available at http://localhost:8025; host application SMTP is `127.0.0.1:1025`. Password login creates only a pending challenge. Read the code in Mailpit and complete verification before using finance APIs. Institution simulator credentials are separate generated entries; never enter real bank credentials.

The application requires `OTP_HMAC_SECRET` of at least 32 characters. Local HTTP is permitted only with `ALLOW_LOCAL_HTTP=true` and a localhost `APP_URL`. Shared deployments require HTTPS. NVIDIA configuration is server-only: `NVIDIA_API_KEY`, accessible `NEMOTRON_MODEL`, optional HTTPS `NEMOTRON_BASE_URL`, timeout at most 30000 ms. No `NEXT_PUBLIC_*` secret is supported.

Missing NVIDIA configuration returns 503 for new runs/chat/demo events without applying an event. Provider failures create failed or explicit partial runs, never fabricated live findings. Local acceptance tests mock inference and perform no NVIDIA calls. Do not run live smoke scripts when operating in local-only mode.

## Backend run and event flow

After login (new demo dashboards are already preloaded), unsafe calls require the session's `fp_csrf` value in `X-CSRF-Token` and the exact configured `Origin`. Cookies remain browser-managed. Do not copy session tokens into source, logs or examples.

1. `POST /api/v1/runs` with `{"intent":"cash","idempotency_key":"local-checkup-1"}` returns 202, `run_id` and snapshot version. Other intents: `subscriptions`, `planning`, `stress`, `full`.
2. Poll `GET /api/v1/runs/:id` and `GET /api/v1/runs/:id/events?cursor=...`. Keep `next_cursor` for incremental polling. Status, safe role steps, evidence references, partial failures and call counts are persisted.
3. `POST /api/v1/runs/:id/cancel` stops new tools/provider calls. It accepts an empty body or `{}`. Persisted partial activity remains an audit record.
4. `POST /api/v1/chat` with `{"message":"Explain the current findings."}` reads only the current user's scoped snapshot/findings. `Run a financial checkup` explicitly permits a bounded run request; ordinary questions cannot start one. Conversation IDs are owner-checked. Raw user messages are not persisted; at most 20 assistant messages per conversation are retained, and each response grounds on fresh server state plus up to three recent successful exchanges held only in server RAM. Context expires after 15 minutes of conversation inactivity, resets when financial scope changes, clears on logout and is lost at server restart.
5. With `DEMO_MODE=true`, `POST /api/v1/demo/events` accepts `{"kind":"surprise_expense","amount_cents":200000,"idempotency_key":"demo-expense-1"}` or `{"kind":"delayed_income","days":7,"idempotency_key":"demo-delay-1"}`. Identity and accounts are selected by the server, never supplied by the client/model. The event changes a selected account/identified income occurrence once, advances the snapshot and queues repair atomically. Reusing a key with another payload returns 409.
6. Repair proposes a new application plan version and keeps the previous accepted plan intact. Missing goal funding/payment metadata is explicit: the conservative monthly revision pauses optional allocations for review, preserves reserve/bills/minimums, and reports `needs_information`. It does not claim the unavailable Goal Allocator ran. Accept only through `/plans/:id/accept` with expected version and explicit confirmation.

One checkup per user and two queued/running checkups per process are allowed. Each run shares 24 model calls, at most two active roles and bounded provider/role deadlines. Per-user run/event/chat limits also apply. Database results survive restart; interrupted work fails visibly and is never silently re-inferred. Run this SQLite prototype as one persistent application process. The specialist workspace, full coach and popup are integrated; actual model execution requires configured Nemotron access.

## Local acceptance checks

```sh
npm run typecheck
npm run test:backend
npm run test:agents
npm test
npm run build
npm run verify:security
```

Backend tests use fresh temporary seeded databases, real local SQLite and a test SMTP receiver. Inference is mocked. Tests cover HTTP login/verification/link/run/logout, cross-user reads/mutations, CSRF, invalid identity fields, cancellation, stale snapshots, budgets, duplicate and failed events, consent disconnects, plan acceptance conflicts and missing/failed providers. Agent tests include tool argument manipulation, malicious merchant data and outbound offer SSRF/redirect guards.

The security audit checks configured secret values against reviewable source and built browser bundles (and local logs supplied with repeated `--log path` arguments), checks server-only field names in browser JavaScript, Git/Docker exclusions and dependency declaration/lockfile agreement. It prints no secret values. Run it after building. This does not certify production security or scan removed historical Git objects. Repository-wide lint still has existing explicit-any issues; use `npm run lint` to see the current report.

## Persistent storage and reset

Data files and generated credentials are private and Git-ignored. App restarts, migrations and repeated setup preserve accounts, runs, plans and events. For an intentional reset of **disposable local demo data**, stop the app first:

```sh
python3 scripts/seed_demo.py --reset
npm run db:migrate
python3 scripts/validate_seed.py
```

Reset deletes sessions, linked accounts, run history, plans and events and generates new demo passwords. Do not reset a database you need to preserve. `validate_seed.py` validates the fresh unlinked seed, not an application database after accounts have been linked.

## Container runtime

```sh
docker compose build app
docker compose run --rm app npm run setup
docker compose up -d
```

Compose loads `.env.local`, stores the SQLite database in `finpilot-data`, sets container SMTP to `mailpit:1025`, and binds host app/inbox ports to localhost. Keep `.env.local` configured with server-only secrets; it is excluded from the image. The application runs as a non-root user. `docker compose down` preserves the named volume; `down -v` deletes it. Images and Mailpit are pinned in the repository. Container startup itself never reseeds automatically. Container runtime availability must be verified on the demo machine; the local acceptance record does not claim a Docker daemon was tested here.

## Verify prepared presentation data

Use your effective `DATABASE_PATH`:

```sh
python scripts/validate_presentation.py --database ./data/finpilot-demo.sqlite
```

This read-only check verifies ten recognized users, complete account types, authorized preloaded access, history, SQLite integrity and balance reconciliation. `validate_seed.py` remains the separate validator for the original unlinked raw seed; it is not the validator for a prepared or user-modified application database. Existing databases are never reset by setup. A local Python executable can be selected with `PYTHON` if automatic discovery fails.
