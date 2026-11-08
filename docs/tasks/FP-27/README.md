# FP-27 — Agent workspace with chat run cards and evidence navigation

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | A + B |
| Estimate | 3–5 focused hours, excluding review and provider delays |
| Dependencies | FP-26; existing FP-15 run/evidence APIs |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Agent workspace with chat run cards and evidence navigation. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.46–50 and 57; agent-running, agent-results, finding-evidence, agent-partial.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Implement /agent-workspace with coordinator plus eight specialist status rows, dependencies, actual tool activity, findings and cancellation.
2. Use POST /runs and incremental event polling. Stop polling on terminal status/unmount; deduplicate cursor events, handle reconnect and retain partial results honestly.
3. Render requested_run_id from chat as a linked run card. Use an explicit Request checkup control rather than inferring permission from ordinary questions.
4. Reuse the evidence drawer with owned evidence IDs. Ask about this finding supplies a validated reference, not an entire raw statement; before that additive context is available, use a server-validated finding identifier or general explanation.

## Implementation area

src/app/(workspace)/agent-workspace/page.tsx; src/components/agents/*; src/lib/runs-api.ts; existing evidence-drawer.tsx.

## Acceptance criteria

- [ ] Visible role progress comes from real run status/events, never PDF sample counts or timers.
- [ ] Skipped, needs-information, failed, cancelled and stale states are visibly distinct.
- [ ] Cancellation stops further runtime calls; stale evidence cannot reopen as current.
- [ ] An evidence link can be followed from a conversation to its originating run/finding and back.

## Verification

Polling/cursor/cancel/ownership tests, mobile keyboard checks and screenshots. This delivers the original FP-07 baseline with FP-26.

## Pull request handoff

Use a branch such as `feat/fp-27-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
