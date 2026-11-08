# FP-07 — agent workspace and teammate-owned chat boundary

## Current integrated review status

Current main provides authenticated run/status/events/cancel APIs, now wired into the workspace using its actual envelopes. Bounded polling, server cancellation, reported findings/events, stale suppression and scoped evidence are implemented and regression tested. A real browser start returns 503 ai_unavailable because local NVIDIA_API_KEY and NEMOTRON_MODEL are missing; configuration and chatbot code remain untouched. Chat frontend integration is pending the teammate and its acceptance is incomplete. Earlier missing-route observations below are historical checkpoint findings, superseded by FP-08/IMPLEMENTATION.md.

## Historical checkpoint notes


Prepared on the combined FP-05–08 branch. **FP-07 is not fully complete or verified against a real run/chat response.** No competing chatbot, model provider, backend runtime, agent framework or chat contract was added.

## Inspection and ownership

Current route inspection found only `src/app/api/v1/[...path]/route.ts`. Its handler exposes finance/planning/auth endpoints but no run, event, cancellation or chat handlers. Agent runtime modules exist under `src/server/agents/runtime`; they are not HTTP wiring. No chat component was found in this checkout. The teammate continues to own the full chatbot and its backend/contracts. Their components and runtime files are untouched.

`ChatBoundary` is a collapsible integration slot, not a chatbot. Its future explain-finding interface is `{runId, findingId, evidenceIds}` using actual returned references. Selecting a finding prepares that reference and opens the unavailable-state panel; no explanation or model response is invented. The teammate's eventual component should consume this reference and the existing verified-session context, with its own agreed API. Do not infer live model execution from synthetic financial source labels.

## Delivered boundary

- Protected `/agent-workspace`; compact role/status views for Data Integrity, Cash Collision, Subscription Detective, Deal Scout, Debt and Purchase Readiness, Goal Negotiator, Stress-Test, Plan Repair and Coordinator.
- Without a server run response, every status is **Not reported**. Cards never imply a job was queued or completed.
- The documented checkup request boundary handles absent endpoints honestly. It is disabled for empty account scope and after an unavailable request; no progress or response is simulated. A user can inspect a supplied run ID against the documented path and see the actual unavailable response.
- Prepared run/status/event DTOs are explicitly provisional until FP-15/23 supply their HTTP contract. Actual returned results can display findings, assumptions, missing inputs, partial/stale state, tool events, handoffs and scoped evidence links. Unknown envelopes are rejected rather than shown as success.
- Polling is serial, bounded to 60 rounds, starts at two seconds, backs off up to ten seconds, stops after three failures and stops on terminal/cancelled status, unmount or scope loss. Pausing local polling is explicitly not represented as server cancellation. There is no invented cancellation endpoint.
- Aborted transports that resolve late cannot start a follow-up event request or restore state. User/snapshot changes invalidate the surrounding scope. Financial source labels remain separate from model status.

## Files and verification

`src/app/(workspace)/agent-workspace/page.tsx`, `src/components/planning/agents.tsx`, shared `workspace-state.tsx`, `shared.tsx`, `modal.tsx`, `planning.css`, and the run/evidence boundary in `src/lib/workspace-api.ts`.

Focused component tests cover terminal polling, no overlapping requests, abort/unmount, missing service handling and no simulated completion. Browser tests verify the role layout, unavailable boundary, 1440/390px overflow and axe. The real authenticated rehearsal confirmed 404 for a run path and captured the unavailable dependency screen. **No real run, tool dependency handoff or chat reply is claimed.**

Screenshots: [desktop fixture](evidence/agents-fixture-1440.png), [mobile fixture](evidence/agents-fixture-390.png). These use labeled automated test responses; [real unavailable boundary](../FP-08/evidence/run-boundary-real-1440.png) uses the actual backend.

Remaining blockers: authenticated run/start/status/event/cancel wiring and agreed response envelopes; Nemotron provider execution through that wiring; teammate chat component/API and reference contract. Complete these before claiming FP-07 acceptance. Full checks and real-journey limitations are in [FP-08](../FP-08/IMPLEMENTATION.md).

## Shared final check results

73 component/session tests, 14 backend tests and all 25 Chromium tests pass; typecheck, production build and whitespace checks pass. Lint retains 92 baseline errors and one warning with zero new findings. Real-browser results remain limited to the explicitly described partial journeys; fixture tests do not remove backend blockers.
