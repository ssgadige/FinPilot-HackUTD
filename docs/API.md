# API v1 — contract to implement

Prefix `/api/v1`. JSON, ISO 8601 UTC timestamps, date-only financial dates `YYYY-MM-DD`, integer USD cents, pagination default 50/max 200. Ledger signed delta: positive increases asset balances; negative spends. Liability transaction signed delta: positive charge increases owed balance, negative payment decreases owed balance. Account kind determines interpretation. No client-supplied user_id. All finance routes require completed password + email verification.

| Method/path | Input | Result / rules |
|---|---|---|
| POST /auth/login | email, password | 202 challenge_id, masked_email; pending cookie only |
| POST /auth/verify | challenge_id, code | authenticated cookie, safe profile; reject expired/replayed code |
| POST /auth/resend | challenge_id | 202 generic response; cooldown |
| POST /auth/logout | CSRF token | revoke session, 204 |
| GET /me | — | id, display_name, email, simulation flag; never hashes |
| GET /institutions | category optional | provider list; no user's simulator secrets |
| POST /connections/preview | institution_id, demo_username, demo_password | 202 challenge_id, masked_email, expires_in_seconds, resend_after_seconds; HttpOnly pending-link binding only; no preview/account access |
| POST /connections/verify | challenge_id, code | scoped single-use verified preview_token, institution_id, expires_at, consent_version, accounts with exact record scope |
| POST /connections/resend | challenge_id | 202 generic acknowledgment; 60-second cooldown; invalidates earlier code |
| POST /connections | preview_token, account_ids, consent_version, idempotency_key | connection and sync summary; ownership and consent required |
| POST /connections/:id/sync | idempotency_key | updated snapshot_version; no duplicate transactions |
| DELETE /connections/:id | confirmation | revoke access, mark dependent findings stale |
| GET /accounts | institution_id optional | AccountsResponse: authorized linked items, authenticated user's snapshot_version, source_mode and as_of; includes metadata for empty lists |
| GET /transactions | account_id, from, to, category, q, cursor | scoped Page<Transaction>; account filter optional |
| GET /overview | — | liquid_cash_cents, debt_cents, net_worth_cents, indicators, upcoming_bills, snapshot_version |
| GET /forecast | days: 30 or 90 | dated balances, assumptions, low_cash_date; calculation evidence |
| GET /subscriptions | — | recurring candidates, confirmed status and preference fields |
| PATCH /subscriptions/:id | usage/preference confirmation | saved preference; cannot execute cancellation |
| GET /subscriptions/:id/offers | — | comparable offers with source_mode, retrieval time, terms |
| POST /subscription-actions | subscription_id, offer_id or cancel intention, confirmation | planned action; do not mark realized savings |
| GET/POST /goals | GET —; POST title,target_cents,deadline,priority | scoped goals; positive targets and valid dates |
| PATCH /goals/:id | amount/deadline/priority | version update; rerun planning if needed |
| GET /debts | — | balances, APR, minimums, credit limits if known |
| POST /scenarios | kind, expense_cents/delay_days/income_drop_pct, plan_id optional | validated bounded scenario and calculated outcomes |
| POST /runs | intent, goal_id optional, idempotency_key | 202 run_id; snapshot and role plan |
| GET /runs/:id | — | status, role steps, findings, concise trace, snapshot_version |
| GET /runs/:id/events | cursor optional | incremental events; ownership checked |
| POST /runs/:id/cancel | — | cancellation requested; stop new tools/calls |
| GET /plans | — | proposed/accepted/stale versions |
| POST /plans/:id/accept | expected_version, confirmation, idempotency_key | atomic acceptance or 409 version conflict |
| POST /demo/events | kind: surprise_expense/delayed_income, amount_cents/days, idempotency_key | DEMO_MODE only; user-scoped event; triggers plan repair proposal |
| POST /chat | message, conversation_id optional | Nemotron reply, evidence_ids, requested_run_id optional; bounded history |

Errors: 400 invalid input, 401 missing/incomplete auth, 403 forbidden, 404 unknown or not-owned object (consistent non-enumerating policy), 409 stale version, 429 rate limit, 502 provider failure, 503 unavailable integration. Format: {error:{code,message,request_id}}. Do not leak stack traces or secret provider payloads.

## Accounts response agreement (FP-04 / FP-12)

`contracts/types.ts` defines `AccountsResponse` and `AccountSummary`, reused by the frontend adapter and backend. `snapshot_version` is the authenticated user's current database value, read in the same transaction as the account list. Filtering by institution or returning an empty list does not change or omit it. No user identity is accepted from the client. `source_mode` remains `fixture`; `as_of` comes from the dataset's observation metadata, not the wall clock. Account `last_sync_at` is omitted when unknown; it is never fabricated. Financial totals and other endpoints retain their existing contracts; this accounts agreement does not resolve their remaining FP-04/FP-12 field differences.

## Example overview

```json
{"liquid_cash_cents":540000,"debt_cents":1760000,"net_worth_cents":920000,"indicators":[{"key":"cash_buffer_months","value":1.8,"source_mode":"fixture","explanation":"Liquid cash divided by essential monthly spending"}],"upcoming_bills":[],"snapshot_version":1}
```

Example numbers illustrate shape only, not seeded values. Frontend must replace contract fixtures with real API responses. All simulated financial records remain source_mode=fixture even when Nemotron inference itself is live. A live inference call does not make synthetic financial data live.

## Tools

Use strict role-specific tool schemas. Tools never accept arbitrary SQL or user identity. Money/date arithmetic returns evidence IDs and assumptions. Scope joined queries on user and connected selected account; ownership on the parent alone is insufficient if a supplied child ID belongs to another user.

## Institution verification integration

Institution challenges use a separate HMAC domain and additive `institution_challenges` table. They bind the authenticated user, institution, current hashed session and random pending-link cookie. Codes expire after five minutes, allow five attempts and are single use. Resending after 60 seconds invalidates the earlier code. SMTP failure consumes the challenge. Every mutation retains Origin and session-bound CSRF checks. Neither codes nor entered credentials are retained as plaintext. Preview creation happens only after verification; explicit selected-account consent is still a separate step. Existing internal simulator helpers are test/service primitives, not alternate HTTP routes.

`GET /connections` returns `{items:[{id,institution_id,status,last_sync_at,account_ids}]}` for the authenticated user's active connections. POST retains its existing top-level id/sync and adds a confirmed `connection` envelope for the UI. DELETE returns `{revoked:true,snapshot_version}`; the frontend accepts this confirmed receipt and clears financial state before refreshing accounts/overview.

Financial integration adds presentation aliases without removing legacy FP-12/tool fields: transactions include `date`, `description`, signed `amount_cents`, classification/status and real user snapshot metadata; overview adds authoritative server investment totals and indicator inputs; scheduled bills include the next date; forecast adds linked liquid `account_ids`, `balances` and dated expense commitments. Original `posted_date`, `delta_cents`, basis-point indicators and `dated_balances` remain available. Income event details are not synthesized when demo delays require additional context. The chart's authoritative balances continue to come from the server forecast tool. Frontend basis-point conversion is display formatting only.

Run responses use `run_id`, `role_steps` (`role` or in-progress `agent_id`), top-level `findings`, `stale`, and `inference_source_mode`. Events use a numeric-string cursor and `has_more`. Frontend cancellation calls the existing POST endpoint; chat implementation is unchanged and its frontend integration remains pending.

Subscription GET now reuses the existing deterministic recurring detector, adding `recurrence` matching-charge/price-change details and `{summary:{monthly_equivalent_cents,annual_recurring_cents,complete,assumptions},snapshot_version,source_mode,as_of}`. Incomplete/empty detection produces null totals. It does not aggregate a cursor page or infer unused services. Offer responses add optional billing interval, promotion, terms, retrieval and availability fields from the existing source; an explicitly confirmed music category enables the supported fixed-provider comparison. Fixture offers are never labeled live.

## Chat session context

The verified session injects user identity and the private session binding. Clients still send only `message` and optional `conversation_id`; `history`, role messages and session/user identity fields are rejected. The response may include `context: {mode: "session_only", retained_turns, max_turns: 6, expires_after_seconds: 900, snapshot_version, reset}`. Reset is `new_or_expired`, `continued`, `snapshot_changed` or `source_unavailable`. Older clients can ignore this additive metadata.

Context is held only in server memory, bounded and expired per conversation, cleared on logout and lost at process restart. Snapshot/account-scope changes and inaccessible selected evidence discard old context; financial facts are reloaded on every turn. This does not add saved-history APIs or alter the existing assistant/evidence audit persistence.
