# Credit health and grounded coach upgrade

## Changes

- Credit health page with explicit demonstration-monitor connection, persistent consent, twelve monthly scores, distinct profiles for all ten existing users, linked-card utilization and confirmed disconnect. The data remains fictional; no bureau is contacted.
- Large checkup result dialog, urgency-ordered findings, direct explanation and evidence actions. Completed/current results can open automatically; failed/skipped/stale states retain their status. Explanation pre-fills a question without implicitly calling the model.
- Shared structured result renderer for both chat surfaces: clear headings, priority findings, missing details, calculator tables, official links and expandable assumptions. No raw object rendering or model HTML.
- Nemotron tools for deterministic loan/savings calculations, scoped credit reports and fresh fixed official lender-page lookup. Missing user-supplied amount, term or APR triggers clarification. Existing Decimal calculators handle the arithmetic.
- Owned completed run references can be explained directly; current snapshot and evidence/ownership checks remain mandatory. Structured prose is sanitized alongside legacy reply text.

## Validation

- Production build and TypeScript compilation pass.
- Backend: 48 tests pass; UI: 129 tests pass; agent runtime: 78 tests pass; Python seed/login-repair regressions: 12 tests pass.
- Scoped lint for new credit/renderer/adapter/browser-test files passes. Repository-wide historical lint findings were not suppressed.
- Built browser bundle/source security audit passes (31 browser chunks). No key, credential, generated database or OTP artifact is included.
- Desktop/mobile credit and structured-popup browser checks pass, including automated accessibility, overflow, consent/disconnect, calculator layout and official-link assertions. The complete regression result is recorded in the pull request. UI/API/model fixtures do not prove live inference, live lender terms or real bureau connectivity.

## Evidence

Desktop and mobile images under `docs/fixes/evidence/credit-coach/` are explicitly labeled fixtures:

- `credit-fixture-1440.jpg` and `credit-fixture-390.jpg`: connected credit view, history, factors, approval limits and disconnect.
- `structured-popup-fixture-1440.jpg` and `structured-popup-fixture-390.jpg`: readable calculator answer and official source presentation.

## Important boundaries

All AI inference remains on the existing Nemotron adapter. No live NVIDIA call was attempted during this change. Use [the live validation prompt](../NEMOTRON_HANDOFF.md) on the configured machine.

The source tool fetches only fixed PNC, Bank of America and Chase product pages per relevant tool execution. It rejects redirects and private destinations, pins validated DNS, limits response size/time, and sends no personal financial data. A successfully retrieved page is not a verified APR or underwriting threshold. Blocked pages are explicitly unavailable. Full-market search, structured lender-term extraction/ranking, real bureau integration and a calibrated approval model are not implemented.

Credit score alone does not establish an approval chance or amount. The app returns unknown/missing criteria rather than an invented percentage or guaranteed full/partial funding. There are no payments, transfers, purchases, applications or credit pulls.

Existing specialist integration limitations remain visible; this change does not claim every role has complete backend wiring. Existing seeded bank data, account selections, passwords and OTP requirements are preserved. Credit profiles are created additively for the ten exact seeded identities; no database reset is needed.

## Running the update

Pull merged `main`, install locked dependencies if required and rebuild/restart the local or Docker app with its existing environment and persistent database volume. If old Next build output causes a build-ID mismatch, remove only `.next` and rebuild. Do not delete database files or Docker volumes. Each machine using its own database must run the updated app; a Git merge does not synchronize private databases or Mailpit inboxes.
