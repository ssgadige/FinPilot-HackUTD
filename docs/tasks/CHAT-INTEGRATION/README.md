# Financial team and coach integration

## Result
Combines PR #49 (`ace205ce`) and PR #50 (`51426a87`) without replacing either implementation. The integration commit has both feature heads as parents; `main` was `8fb621f` during review.

| Area | Integrated behavior |
| --- | --- |
| Specialist team | Default workspace, nine declared roles, server-reported statuses/findings, bounded event polling, cancellation and stale-result suppression |
| Financial coach | Nemotron endpoint, current-data grounding, three recent exchanges in session-only context, evidence inspection and actual run controls |
| Finding handoff | Explain finding opens a reviewable draft using an evidence reference; selection alone never sends a model request |
| Workspace navigation | Team/coach views keep the conversation mounted; an identity change clears the whole private workspace; header opens the coach directly |
| Banking UI | Shared navy/teal visual system, meaningful role descriptions, responsive controls, links to cash, subscriptions and goals |
| Existing frontend | Subscription comparisons, goals/plans, assets, scenarios and server financial DTO integration retained from #50 |
| Institution security | Password plus institution email challenge, explicit selected-account consent, saved connections, sync and confirmed disconnect retained |

## Conflict resolutions
- One protected `/agent-workspace` route hosts both implementations; no duplicate placeholder or chatbot backend.
- API retains institution verification, atomic accounts metadata and recurring summaries together with sanitized, session-bound chat and logout context cleanup.
- Account scope retains both checking-session protection and empty-account support.
- The HTTP regression covers password/OTP, institution OTP, linking, follow-ups, evidence, run/cancel and logout together.
- Test harness exposes both original frontend modes and the coach. Coach browser tests explicitly select their isolated fixture origin.
- Bill projections retain typed canonical fields for both presentation and sanitized model input.
- Run creation retries reuse an idempotency key; terminal events drain remaining pages. Cached inference is explicitly identified.
- Removed server configuration variable names from a client-facing error; the unchanged security audit now passes.

## Verification
| Check | Result |
| --- | --- |
| Production build and TypeScript | PASS |
| Component/session tests | 121 PASS |
| Backend tests with SQLite and local SMTP receiver | 38 PASS |
| Agent/tool/provider unit tests | 78 PASS |
| Seed and credential repair tests | 12 PASS |
| Chromium browser tests | 33 PASS |
| Scoped UI/adapter/test ESLint | PASS |
| Static source/browser audit | PASS; 28 browser chunks |
| Whitespace review | PASS |

Browser checks include desktop/mobile axe, real anonymous protected-route denial, fixture OTP/consent flows, evidence focus containment, conversation isolation, stale snapshots, cancellations and the combined finding-to-coach handoff. Screenshots below contain only explicitly labeled synthetic fixtures. The local Chromium runner used an isolated browser binary with normal multiprocess contexts; no project dependency or lockfile was changed. An initial local runner configuration lacked the production server and used incompatible single-process browser settings; those environment failures were corrected before the full 33-test pass, without weakening assertions.

## Limits
Inference is mocked in automated verification. No live NVIDIA call, real offer availability, lender approval, full sponsor rehearsal or successful live plan acceptance is claimed. Server configuration remains necessary for actual model calls. Some planning specialist application mappings remain unavailable and must stay disclosed; nine role cards do not establish nine functioning specialists. Repository-wide inherited lint findings remain; no lint rules or assertions were disabled.

No personal financial data, generated credentials, OTPs, database, environment file or runtime mailbox was committed. No payment, transfer, subscription cancellation, credit application or merchant purchase is implemented.

## Screenshots
- [Specialist workspace, desktop fixture](evidence/specialists-fixture-1440.png)
- [Coach, desktop fixture](evidence/coach-fixture-1440.png)
- [Coach, mobile fixture](evidence/coach-fixture-390.png)

## Team update
Pull the merged main and rebuild/restart the local app or Docker app image while preserving the existing database volume. Git distributes source, not local databases, Mailpit inboxes or server secrets. Use the configured origin consistently. The existing credentials and connection selections are not reset by this integration.
