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
| POST /connections/preview | institution_id, demo_username, demo_password | short-lived preview token and owned account labels only |
| POST /connections | preview_token, account_ids, consent_version, idempotency_key | connection and sync summary; ownership and consent required |
| POST /connections/:id/sync | idempotency_key | updated snapshot_version; no duplicate transactions |
| DELETE /connections/:id | confirmation | revoke access, mark dependent findings stale |
| GET /accounts | institution_id optional | authorized linked accounts and last sync |
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

## Example overview

```json
{"liquid_cash_cents":540000,"debt_cents":1760000,"net_worth_cents":920000,"indicators":[{"key":"cash_buffer_months","value":1.8,"source_mode":"fixture","explanation":"Liquid cash divided by essential monthly spending"}],"upcoming_bills":[],"snapshot_version":1}
```

Example numbers illustrate shape only, not seeded values. Frontend must replace contract fixtures with real API responses. All simulated financial records remain source_mode=fixture even when Nemotron inference itself is live. A live inference call does not make synthetic financial data live.

## Tools

Use strict role-specific tool schemas. Tools never accept arbitrary SQL or user identity. Money/date arithmetic returns evidence IDs and assumptions. Scope joined queries on user and connected selected account; ownership on the parent alone is insufficient if a supplied child ID belongs to another user.
