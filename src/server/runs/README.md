# Authenticated runs, chat and change triggers (FP-15/16)

`Runs` is wired through the existing `/api/v1/[...path]` handler and `getServices`. Authentication and CSRF checks run before dispatch. Neither requests nor model tool schemas accept user identity; strict schemas reject unknown fields. The verified session supplies the owner, and the consent-scoped bridge supplies account selection and snapshot.

## Runs and polling

POST `/runs` returns 202 with an immutable context, queued status and snapshot version. Supported intents are cash, subscriptions, planning, stress and full; an optional goal must be owned. SQLite stores request fingerprints, role steps, safe events, numerical evidence and private grounded-chat records. Repeated keys return the original run; different input with the same key returns 409. Public run views expose concise traces, not private tool-output records.

One checkup per user, two queued/running checkups per process, ten new checkups per user/hour, and a shared 24-call budget constrain execution. Each runtime role retains its deadline, three-call batch/four-round limits and two-active-role limit. Partial capability/provider results remain explicit. Missing Nemotron configuration returns 503 before queuing or mutating events; a failed provider/validation yields a failed run, not fake findings.

Cancellation changes persisted status and aborts the runtime signal. No new tools or model calls start afterward, even if an already-started provider ignores cancellation. Polling uses a bounded incremental cursor with ownership checked on every read. Snapshot changes/disconnects mark results stale and hide their findings/trace; evidence reads also reject stale scope. Safe historical activity remains visible.

SQLite results survive process restart. Startup marks interrupted queued/running work failed, without reapplying events or silently repeating inference. This is a single-process persistent SQLite prototype, not a distributed worker queue.

## Demo events and application repair

DEMO_MODE must be explicitly true. Event mutation, snapshot invalidation, durable idempotency record and repair queue insertion commit atomically. Failed storage rolls everything back. Provider failure after a committed event retains its one financial effect and the accepted baseline; replay does not apply the effect or infer again.

A surprise expense uses a server-selected linked checking account (or savings fallback), updates its balance and adds a matching fixture ledger entry. Delayed income targets a selected liquid account's identified next scheduled occurrence; forecasts and agent snapshots use that same date shift. Other users and subsequent unrelated income occurrences are unaffected. Both event shapes are validated and bounded.

Application plan allocations are monthly; the earlier specialist fixture planner uses one-period allocation semantics. The adapter does not guess a conversion. When funding/payment metadata is unavailable, a real Plan Repair role uses actual changed-event/forecast tools and a conservative monthly candidate that pauses optional contributions/extra debt payments while retaining the reserve and scheduled bills/minimums. It must return needs_information and disclose that updated Goal Allocator did not run. No predecessor analysis is fabricated.

The proposed application plan has fresh evidence, a parent accepted version and requires explicit acceptance through the version-checked plan route. Old accepted payloads remain intact for audit. Repair does not automatically accept, transfer funds or execute cancellations. General debt/goal/stress planning remains unavailable through the bridge until account/date mappings exist; those skipped capabilities are explicit.

## Chat

Every read rechecks the user/snapshot/account scope and validates original finding evidence. Conversation IDs are owned, input is bounded, credential-shaped messages are rejected, and raw user messages are not stored. At most 20 assistant messages per conversation are retained. Responses ground on fresh state plus bounded, untrusted session-only conversation context. Up to three recent successful exchanges expire after 15 minutes of conversation inactivity; logout, session change or server restart prevents reuse. Snapshot/account-scope changes reset context. User turns are not written to SQLite. See [CHAT-05](../../../docs/tasks/CHAT-05/README.md). Chat has per-user hourly limits and at most two active requests per process.

An ordinary question receives only read tools. An explicit request such as `Run a financial checkup` permits the run-request tool, whose callback injects the session user and an idempotency key. Chat cannot choose users, accept plans or execute financial actions.

## Verification

`tests/backend/runs.test.ts` exercises the authenticated handler with real SQLite and deterministic tools plus mocked inference: 202/polling, durable replay, two-user access, CSRF/pending sessions, cancellation, provider failure, model identity manipulation, atomic rollback, event repair/confirmation, delayed-income agreement, grounded chat, HTTP login/link/run/logout, HTTPS cookie flags, idle/absolute expiry and restart handling.

Run `npm run test:backend`, `npm run test:agents`, `npm run typecheck`, `npm test`, `npm run build` and `npm run verify:security`. See [setup/reset guide](../../../SETUP.md). Inference mocks and local SMTP tests are not live NVIDIA evidence. The FP-07 workspace and full live three-minute rehearsal remain separate integration work.
