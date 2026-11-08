# CHAT-04 — Checkup requests, run activity and cancellation

Status: implemented and locally verified alongside CHAT-03.

- [x] Explicit Run financial checkup button calls the authenticated run endpoint.
- [x] Pending checkup requests show their own request state without pretending a chat reply is being generated.
- [x] Duplicate clicks are blocked; ambiguous create retries reuse the original idempotency key.
- [x] Chat-requested run IDs attach without a second create request.
- [x] Sequential incremental polling deduplicates event IDs and stops at terminal/stale status or unmount.
- [x] Read errors pause polling; refresh reads the same run without starting another model run.
- [x] Role handoffs, actual events, supported findings, trace and financial/inference source labels are displayed.
- [x] Partial, needs-information, failed, skipped, cancelled and stale results remain distinct.
- [x] Cancellation uses CSRF and displays confirmation only after the backend response.
- [x] Logout/user changes discard pending responses. Financial invalidation hides old findings and rechecks scope; terminal runs also revalidate on focus/invalidation.

Implementation: src/components/chat/run-card.tsx, coach-panel.tsx and src/lib/runs-api.ts. The backend retains its existing 24-call budget and ownership checks. The drawer can inspect a chat calculation's source run as well as a financial checkup.

Verification: 91 UI tests, 25 backend tests and four browser tests; mocked inference only. TypeScript, build, scoped lint and configured-secret scans are recorded in [local acceptance](local-acceptance.json). No provider calls, commits or pushes are part of this request.

[Desktop run fixture](evidence/run-fixture-1440.png) · [Mobile run fixture](evidence/run-fixture-390.png).

Run browser checks with `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test --config tests/browser/playwright.coach.config.ts`, or omit the channel variable when Playwright Chromium is installed. The fixture server binds localhost and never replaces the application's authentication guard.

Latest focused recheck: 40 chat/workflow UI tests and four browser tests pass, including duplicate submission, same-key retry, event deduplication, terminal polling stop, cancellation, stale scope and logout cleanup.

Follow-up: [CHAT-05](../CHAT-05/README.md) implements bounded session-only conversational memory, with current-data grounding and no replay of prior action requests.
