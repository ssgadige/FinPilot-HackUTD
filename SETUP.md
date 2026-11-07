# Backend installation

Use Node.js 22.13+ (Node 22 is the team baseline), Python 3.11+, and npm. SQLite uses Node's built-in `node:sqlite`; no native database package or separate database server is needed. Node may print an experimental SQLite warning.

```bash
npm ci
npm run setup
npm run dev
```

`npm run setup` creates a private ignored `.env.local` with a random OTP HMAC secret, generates synthetic data only when the database is absent, and applies backend migrations. It preserves existing configuration and data on subsequent runs. It does not print passwords or OTPs. Generated credentials are in `data/demo-credentials.json` (local only, mode 0600). Override `DATABASE_PATH` in the environment for another database. All records are synthetic fixtures as of **2026-11-07**; forecast dates deliberately use fixture time.

The API is at `http://localhost:3000/api/v1`. This branch contains backend API routes only; no frontend page or layout is provided. The dashboard awaits a Figma design.

## Local email and authentication

Start Mailpit (Docker must be running):

```bash
docker compose up -d mailpit
```

Inbox: `http://localhost:8025`. SMTP: `127.0.0.1:1025`, no credentials. Both bind to loopback. Use only the generated fictional `example.test` accounts. Never enter real bank credentials. Real SMTP requires TLS, a verified sender and explicitly configured `SMTP_ALLOWED_RECIPIENTS`; invented recipients are rejected.

1. POST JSON `{email,password}` to `/api/v1/auth/login` with `Origin: http://localhost:3000`. Keep the HttpOnly `fp_pending` cookie.
2. Read the delivered code in Mailpit. POST `{challenge_id,code}` to `/auth/verify` with the pending cookie and same Origin.
3. Verification returns a safe profile and sets `fp_session` (HttpOnly) and `fp_csrf`. Send the latter as `X-CSRF-Token` on every authenticated POST/PATCH/DELETE, together with the session cookie and matching Origin.
4. GET `/me`, then `/institutions`. POST `/connections/preview` with `institution_id,demo_username,demo_password` from that user's generated institution credentials. POST `/connections` with its `preview_token`, selected `account_ids`, `consent_version:"v1"`, and a unique `idempotency_key`.
5. Read `/accounts`, `/transactions`, `/overview`, `/forecast?days=30`, `/goals`, `/subscriptions`, `/debts`. Initially no accounts are authorized. See [API contract](docs/API.md).
6. POST `/auth/logout` with Origin and CSRF header. The server revokes the session.

Set `ALLOW_LOCAL_HTTP=false` and an HTTPS `APP_URL` on any shared deployment. Never expose the development inbox publicly. The prototype ignores untrusted forwarding headers and uses a conservative shared login IP bucket; configure a trusted proxy adapter before public deployment. Use one Node application process with this SQLite prototype.

## Providers and lane-C integration

Configure `NVIDIA_API_KEY` and `NEMOTRON_MODEL` only in `.env.local` or a hosting secret store. Chat uses the fixed NVIDIA HTTPS endpoint, disables redirects, bounds responses/time, and has no mutation tools. Missing keys return 503; network, malformed, oversized and non-success responses return 502 without provider payloads. Chat does not receive raw ledger records or credentials. Messages containing common credential/OTP patterns are rejected; do not paste secrets into chat.

The specialist runtime and offer adapter are absent from this repository. Run submission, status, event polling, cancellation, request budgets and demo event triggers are implemented, but the default runner records `runtime_unavailable`. This is **not a successful checkup**. Offers/actions referencing offers return `offers_unavailable`. No fallback inference or fabricated live offers are provided.

Lane C integrates through `Runner`/`RunControl` in `src/server/runs.ts` and supplies its runner to `new Runs(store, runner)` at API composition. Call `beforeCall` before every model/tool operation, use the injected immutable `ToolContext`, and pass the AbortSignal to all provider requests. The backend validates returned AgentResult schemas, ownership/snapshot of referenced evidence, 24 model calls, 4 tool operations per role, and a 90-second deadline. Runtime-owned role tool schemas, DAG/dependency execution, numeric evidence verification and real Nemotron smoke tests must also pass before FP-15/16 are considered fully integrated.

`Planning.propose` is a server-only proposal persistence seam for the evidence-gated runtime. A failed revision never replaces an accepted plan. There is no public endpoint accepting model JSON as a financial plan. Accepting a current proposal requires explicit confirmation, expected version and idempotency key. Demo expenses update the fixture ledger once; delayed income shifts the next scheduled income once. Each demo event queues a repair run; it cannot fabricate a repair proposal while the runtime is unavailable.

## Checks and reset

```bash
npm test
npm run typecheck
npm run build
python3 -m unittest discover -s tests -v
npm audit
```

Backend tests use temporary isolated databases and a local SMTP test receiver, not your development records. See [verification evidence](docs/BACKEND_VERIFICATION.md).

For an intentional reset of disposable local data, stop the application first:

```bash
python3 scripts/seed_demo.py --reset
npm run db:migrate
python3 scripts/validate_seed.py
```

Reset removes all sessions, linked-account selections, plans, events and history changes, and regenerates fictional passwords. Preserve `.env.local`. Never reset a running database or remove its WAL/SHM files while a process is using it. Seed validation assumes a freshly unlinked dataset and should run before demo mutations.

## Containers and persistent storage

```bash
node scripts/init_env.mjs
docker compose build app
docker compose up -d mailpit
docker compose run --rm app npm run db:setup
docker compose up -d app
docker compose ps
docker compose down
```

Compose injects `.env.local`, overrides SQLite to `/app/data/finpilot-demo.sqlite` on the `finpilot-data` named volume and SMTP to `mailpit:1025`. The app runs as the unprivileged Node user. The seed is explicit, never an automatic reset on startup. `docker compose down` preserves the volume; `down -v` deliberately destroys it. Credentials inside that volume can be viewed locally with a container shell; do not copy or log them to shared systems. Container image builds exclude env, database, credential, git and local node_modules files.

Docker files are supplied, but image build, volume persistence and Compose health checks require a running Docker daemon to verify. A real Mailpit/NVIDIA smoke test is also required before judging; mock-provider tests do not constitute live integration evidence.
