# Chatbot and conversational coach implementation plan

Status: extended roadmap. The two-hour MVP now has [CHAT-01](tasks/CHAT-01/README.md) and [CHAT-02](tasks/CHAT-02/README.md) implemented locally. [CHAT-03](tasks/CHAT-03/README.md) evidence and [CHAT-04](tasks/CHAT-04/README.md) run controls are also implemented locally. [CHAT-05](tasks/CHAT-05/README.md) now supplies bounded session-only follow-up context. Saved history, long-term preferences and broader coaching workflows remain extended-roadmap work. FP-25–36 below are the larger roadmap and are not all implemented. No GitHub issues, commit/push or live provider calls are authorized by this document.

## Design source and product target

The user-uploaded `FinPilot_All_Screens_and_Task_Guide.pdf` has 85 pages, 47 screens, 24 handoffs and 12 calculator contracts. The guide was extracted and its desktop chat, agent-running and mobile-agent screens were visually reviewed. Use it with the tracked [v2 handoff](../design/frontend-v2/README.md) and [screen manifest](../design/frontend-v2/screens.json). The [uploaded guide](../FinPilot_All_Screens_and_Task_Guide.pdf) is preserved unchanged in the repository alongside the tracked screen manifests.

| Uploaded PDF pages | Screen keys | Coach implementation |
|---|---|---|
| 45–50 | agent-running, agent-results, finding-evidence, chat, agent-partial | Chat, run cards, activity, evidence and partial outcomes |
| 49 | chat: Ask about your next move | Conversation and composer on left, scope/authorization/decision inspector on right |
| 57 | mobile-agents | Stack cards and controls; accessible mobile coach panel |
| 35–38 | goals, goal-editor, plan-compare, accept-plan | Goal clarification, option preview and explicit confirmation |
| 40–42 | scenario-lab, stress-result, plan-repair | Hypothetical changes, stress explanation and revision |
| 52 | settings | Conversation/privacy/coaching preferences |

Reuse the existing navy sidebar, teal controls, white cards, typography, AppShell, shared fields and evidence drawer. Do not copy the prototype's named persona, dollar values, completion counts or successful states into runtime responses. The early SVG set is secondary; v2 and the supplied PDF are the implementation reference. New memory, progress and action-card states are extensions that need design review.

The target coach explains verified finances, asks focused follow-up questions, calculates alternatives, proposes reviewable next steps and supports user-requested check-ins. Keep language supportive and factual. A user statement is not a verified balance, and a reported completed task is not a verified transaction.

## Current foundation and gaps

Already available in the current PR stack: verified-session authentication/CSRF; selected simulated accounts; finance/calculation APIs; POST /chat; run start/poll/events/cancel; evidence ownership/numeric checks; versioned plan acceptance; idempotent demo events and conservative repair; a fixed Nemotron role runtime with call/time budgets.

Not yet delivered: working coach UI, agent workspace, actual multi-turn history supplied to the model, privacy/retention controls for that history, typed coach action previews, progress coaching, general application goal-funding/debt-payment mappings and full browser/live acceptance. Stored assistant messages alone are not conversational memory. General planning/stress tools are unavailable through the application bridge until metadata exists. Offer application wiring and full FP-05/06 screens remain separate dependencies when those capabilities are promoted.

The chatbot should reuse the existing Nemotron adapter, deterministic finance tools and server authorization. LangChain, LangGraph and document/vector RAG are not prerequisites. A document knowledge base is deferred until a separate requirement exists.

## Ordered backlog

Task IDs below are proposed local specifications, not GitHub issue IDs. All acceptance boxes start unchecked.

| Task | Deliverable | Estimate | Dependencies |
|---|---|---:|---|
| [FP-25](tasks/FP-25/README.md) | Chatbot design mapping and contract handoff | 1–2 h | FP-07, FP-15, FP-23 implementation inventory |
| [FP-26](tasks/FP-26/README.md) | Responsive chatbot interface and authenticated API client | 3–4 h | FP-25 |
| [FP-27](tasks/FP-27/README.md) | Agent workspace with chat run cards and evidence navigation | 3–5 h | FP-26; existing FP-15 run/evidence APIs |
| [FP-28](tasks/FP-28/README.md) | Private bounded conversation memory and conversation APIs | 4–6 h | FP-25, FP-26 |
| [FP-29](tasks/FP-29/README.md) | Conversational coaching dialogue and preference discovery | 4–6 h | FP-28 |
| [FP-30](tasks/FP-30/README.md) | Application planning account mappings and monthly semantics | 4–6 h | FP-25; existing FP-14/20/21 tools |
| [FP-31](tasks/FP-31/README.md) | Grounded coach tools for scenarios and agent workflow handoffs | 4–6 h | FP-27, FP-29, FP-30 |
| [FP-32](tasks/FP-32/README.md) | Reviewable coach action cards and confirmed execution | 4–6 h | FP-26, FP-30, FP-31 |
| [FP-33](tasks/FP-33/README.md) | User-requested check-ins and coaching progress | 3–5 h | FP-29, FP-32 |
| [FP-34](tasks/FP-34/README.md) | Coaching preferences and privacy controls UI | 2–4 h | FP-28, FP-33 |
| [FP-35](tasks/FP-35/README.md) | Coach security and conversational quality evaluation | 4–6 h | FP-28–34 |
| [FP-36](tasks/FP-36/README.md) | End-to-end coach journey and design acceptance | 4–6 h | FP-27, FP-32, FP-34, FP-35 |

## Delivery milestones

1. **Basic chat and agent workspace:** FP-25 → FP-26 → FP-27. Estimated 7–11 focused hours. Delivers the original FP-07 baseline using existing APIs. This is the first usable release; memory and full planning are not advertised yet.
2. **A conversational coach:** FP-28 → FP-29. Estimated 8–12 additional hours. Follow-up answers preserve meaning, with controlled retention and current-data grounding.
3. **Calculated plans and confirmed actions:** FP-30 → FP-31 → FP-32, using FP-29 dialogue and FP-27 activity UI. Estimated 12–18 additional hours. Metadata is a gate for general debt/goal/stress claims; unavailable capabilities remain explicit.
4. **Progress and preferences:** FP-33 → FP-34. Estimated 5–9 additional hours. Check-ins are user requested; background reminders are not included.
5. **Release verification:** FP-35 → FP-36. Estimated 8–12 additional hours. Run local acceptance first, with a distinct pending live-demo gate.

Total rough effort: **40–62 focused engineering hours**, excluding review, unrelated unfinished screens, provider access and deployment troubleshooting. This is an extended roadmap beyond the original three 14-hour workstreams. Estimates are planning assumptions, not completion guarantees. If time is limited, ship milestone 1 and clearly label later capabilities unavailable.

A owns existing visual components and frontend; B owns database, privacy, authorization and typed execution; C owns dialogue, retrieval/tool routing and model evaluation. FP-30 data work can begin after FP-25 while UI/memory work proceeds, but integration follows the listed dependencies. Do not duplicate FP-07/08 work: reference these subtasks from those existing issues; full FP-05/06 completion is not implied by minimal coach forms.

## Architecture and action boundaries

Conversation UI → authenticated chat service → bounded owned conversation context → Nemotron with server-allowed tools → deterministic calculations/evidence gate → grounded reply and optional typed draft.

Confirmed action path: typed server-owned draft → preview → explicit user confirmation → identity/consent/snapshot/version recheck → atomic idempotent execution → persisted receipt and updated UI. The model has no direct financial execution or acceptance tool. Preserve existing API clients; additive contracts and migrations are a deliverable of FP-25, not silently changed by this plan.

Retain the existing 24-call checkup budget and role deadlines. Chat must not launch a full checkup for every turn. Use only relevant current reads, bound history/summary size, and explain skipped/budget-limited work. Inference and financial-data source modes remain separate.

Privacy proposal for FP-25/28 review: session-only conversation by default, explicit opt-in saved history with 20 sanitized recent turns plus bounded untrusted summary and 30-day expiry. Preferences must be confirmed, editable and deletable. Clear-history operations remove derived summaries/drafts, not just visible bubbles. No browser-supplied system/assistant history is trusted. Credentials, OTPs and raw statements never enter analytics or model prompts.

## Concrete user journey and acceptance

1. Sign in and link selected simulated accounts.
2. Open the coach using page 49's layout and ask “Why is there a shortfall when I have savings?”
3. Open the actual dated evidence; no transfer is assumed.
4. Request a checkup and inspect real role events, skipped capabilities and cancellation.
5. Say “I want to save for a car”; the coach asks for missing target/date/buffer.
6. Respond with an amount and later correct it; the same owned discussion updates without changing a verified balance.
7. Compare computed alternatives after required mappings exist; view a hypothetical expense without recording an expense.
8. Review an action card; explicitly confirm a goal or plan once.
9. Record a clearly marked demo event only through its explicit control; inspect a proposed revision while the accepted baseline remains intact.
10. Request a progress review; self-reported completion remains distinct from verified data.
11. Clear history, log out and sign in as another user; no previous user context survives.

Local browser journeys use controlled provider doubles and are labeled mocked. The current user instruction is **local tests only**: no live NVIDIA or public-source rehearsal is authorized by generating these tasks. FP-36 may request explicit authorization later; if not granted, record live acceptance as pending. Replay must visibly say cached/replay. Final acceptance includes mobile/desktop screenshots, keyboard/zoom checks, two-user isolation, stale/disconnect handling, provider failure, injection defenses, type/build checks and configured-secret scans.

## Deferred scope

Document RAG, voice, autonomous financial transactions, auto subscription cancellation, push/email notifications, background reminders, new bank connectivity and investment/trading advice are not part of these tasks. Structured retrieval and deterministic tools support the initial coach. Any later document retrieval or background communications require their own scoped design and authorization.

## Two-hour MVP acceptance

[CHAT-06](tasks/CHAT-06/README.md) records final local acceptance for CHAT-01–06: combined authenticated API workflow, isolated two-user browser journeys, expiry/logout, mobile/accessibility, evidence, run controls and context. Model inference is mocked; the deployed/live sponsor journey is not accepted by these checks. The larger FP-25–36 roadmap remains separate.
