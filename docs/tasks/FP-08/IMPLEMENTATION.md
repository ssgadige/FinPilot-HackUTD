# FP-05?08 integration and review handoff

Branch: `feat/fp-08-frontend-integration-accessibility-and-demo-polish`.

## Foundation and scope

Preserved the existing work with checkpoint commits `fe9bfc0` and `56e2861`, then integrated reviewed main `8fb621f` in `a3d7cac`. Main includes merged PRs #43, #44, #46 and #47. Older overlapping PRs #38/#39 were not merged. Accounts/session conflict resolution retains actual authenticated snapshot reads, branded errors and server denial. Existing planning files and historical screenshot evidence are retained.

No chatbot component, backend, prompts, conversation storage, model settings or agent inference implementation was changed. The existing main run services are reused. Chat frontend acceptance remains pending the teammate's integration; the boundary accepts `{runId,findingId,evidenceIds}` and displays no fake replies.

## Delivered integration

- Complete institution credential ? Mailpit challenge ? verified preview ? unchecked selected-account consent flow. HMAC domain separation, five-minute expiry, five attempts, 60-second resend, single use, user/institution/session/attempt binding, SMTP failure denial and session-bound CSRF. No usable preview or account labels before verification. Runtime never calls actual banks.
- Persisted connection listing after login/restart, sync/retry, confirmed disconnect receipt, immediate financial invalidation and fresh accounts/overview. Existing ownership and idempotent selection remain server enforced.
- Six protected FP-05?07 routes reuse the existing shell, dialogs, tables and authentication scope. Failed, loading, empty, revoked and changed-snapshot states remain explicit.
- Financial DTO aliases preserve original FP-12 fields. Transactions keep transfers visible and use account kind; authoritative totals and forecasts remain server calculations. Investments are separate from liquid cash. Indicator inputs and definitions are supplied by the backend; missing inputs remain unavailable.
- Subscription costs, price changes and matching-charge counts reuse the reviewed deterministic recurring tool against complete authorized history. Unknown patterns yield unavailable totals. Preferences and comparison category require confirmation. Offers reuse the existing allowlisted fetcher and configured source mode, with promotional/renewal/upfront terms and source labels. Intentions never cancel, purchase or realize savings.
- Goals create/edit; actual server payment comparisons, assets, scenarios and scoped evidence. Existing plan acceptance retains version, same-key retries and renewed review after 409.
- Runs use current `run_id`/`role_steps`/findings/event envelopes, bounded serial polling, server cancellation, terminal stopping and stale suppression. Scoped calculation evidence shows returned values and assumptions. No completed model execution is invented.

Necessary additive contracts are documented in `docs/API.md`. No dataset reset, expanded PR #45 seed or credential repair was performed.

## Acceptance evidence

| Task | Evidence and result | Remaining limitation |
| --- | --- | --- |
| FP-05 | Real Chromium saved a preference and explicitly confirmed proposed intention. Real server recurring summaries and matching-charge evidence verified. Fixture browser checks cover offer/source terms, confirmations and failures. | Configured offer mode may be fixture or unavailable; neither establishes a purchasable offer. No saved-intention listing API. |
| FP-06 | Real user B goal create/edit persisted; server baseline/extra-payment comparisons, account-backed scenario, evidence drawer and installed brokerage linking rendered. Fixture tests cover 409 acceptance/review and optional CD maturity. | Installed seed does not give these users CD/IRA snapshots. No real proposed plan was available for acceptance because inference is unavailable. |
| FP-07 | Current run/status/event/cancel adapter regression passes; backend ownership/cancellation/trace tests use test-only inference. Real browser start returned `503 ai_unavailable`, shown honestly. | Local `NVIDIA_API_KEY` and `NEMOTRON_MODEL` are missing. No successful live inference/evidence claim. Chat frontend pending teammate integration. |
| FP-08 | Both real journeys described below; keyboard/axe/responsive fixtures; preserved server auth, CSRF and scope invalidation. | Live agent/plan/chat acceptance remains explicitly incomplete. |

## Real Chromium + Mailpit journeys

Tests used a consistent SQLite backup under ignored `node_modules/.cache/fp05-08/otp-integration.sqlite`, with a process-only database override and the configured `http://127.0.0.1:3000` origin. No network or session mocks were used in these journeys.

1. Maya completed password + fresh Mailpit OTP, then separate real Chase and card credentials + fresh institution OTP. The browser checked no account access before verification, unchecked consent and only explicitly selected account access. Actual overview/history loaded. Subscription preferences and a proposed intention saved. Logout revoked the old session; fresh login restored saved connections.
2. User B completed fresh login, could not access Maya's account (404), and saw no Maya connections. Verified bank/card/investment linking used only installed providers. Goal creation/editing persisted; server payment comparisons and a real account-backed scenario rendered. Its scoped calculation evidence opened from a real result. After server restart both saved connections remained. Confirmed disconnect removed the account from fresh scope and its transaction endpoint returned 404. Logout revoked the old session.

A real run request returned `503 ai_unavailable`; required NVIDIA key/model settings are missing locally and were not changed. This is a configuration blocker, not evidence of agent completion. Real plan acceptance cannot be rehearsed without a returned proposal. Installed seed: ten users, thirty provider logins, existing provider set; no expanded provider seed installed.

## Checks

- Typecheck and production build pass.
- Component/session suite: 74 passing tests.
- Backend suite: 28 tests, including new institution code binding/expiry/attempt/resend/replay and summary ownership/revocation regressions.
- Chromium suite: 25 tests, including protected-server denial and separate labeled fixture UI/axe checks.
- Repository lint: 104 existing errors and one warning in inherited files; changed-file diagnostics are checked separately. No suppressions or weakened assertions. One inherited chat test failed intermittently on an intermediate backend run; its focused retry and subsequent full suite passed without changing chatbot code.
- `git diff --check` and source/artifact review performed before staging.

Runtime configuration, generated credentials, DB copies, mailbox messages, session data and test logs remain ignored and excluded. No secret or OTP is included in screenshots or handoff.

## Screenshots

Files containing `fixture` are automated response fixtures, not live integration. Historical blocked screenshots remain as historical evidence and are superseded by the connected real screenshots below. Real screenshots use synthetic installed records and real backend/Mailpit sessions.

- [Connected overview](evidence/journey-a-connected-overview-real-1440.png)
- [Transactions](evidence/journey-a-transactions-real-1440.png)
- [Recurring costs desktop](evidence/journey-a-subscriptions-connected-real-1440.png) / [mobile](evidence/journey-a-subscriptions-connected-real-390.png)
- [Configured sample offer via real backend desktop](evidence/journey-a-offers-connected-real-1440.png) / [mobile](evidence/journey-a-offers-connected-real-390.png)
- [Saved connections](evidence/journey-a-saved-connections-real-1440.png)
- [Persisted goals](evidence/journey-b-connected-goals-real-1440.png)
- [Assets desktop](evidence/journey-b-assets-real-1440.png) / [mobile](evidence/journey-b-assets-real-390.png)
- [Scenario evidence](evidence/journey-b-scenario-evidence-real-1440.png)
- [Confirmed disconnect](evidence/journey-b-disconnected-real-1440.png)
- [Actual run configuration blocker](evidence/journey-b-real-run-unavailable-1440.png)

Do not merge or auto-close incomplete issues. Review this combined integration with the remaining agent configuration, real proposal acceptance and teammate chat criteria visible.

Final restoration: the original `./data/finpilot-login-test.sqlite` is running again at `http://127.0.0.1:3000`. Fresh real Chromium/Mailpit login, helpful unlinked scope and logout passed there. Content checks confirmed existing users, credential records, financial records and connections were unchanged; `.env.local` remained identical. Only normal auth activity and additive runtime tables occurred. Real offers testing explicitly confirmed MusicCloud's music category; the configured source returned a clearly labeled Sample offer, not a live merchant offer.
