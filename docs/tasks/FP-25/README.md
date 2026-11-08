# FP-25 — Chatbot design mapping and contract handoff

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | A + B + C |
| Estimate | 1–2 focused hours, excluding review and provider delays |
| Dependencies | FP-07, FP-15, FP-23 implementation inventory |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Chatbot design mapping and contract handoff. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.45–50 and 57; v2 keys chat, agent-running, agent-results, finding-evidence, agent-partial, mobile-agents.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Map page 49 into the existing AppShell: conversation/composer in the main area, scope/authorization/evidence inspector on desktop, stacked controls on mobile. Keep navy, teal, cards, labels and typography from the supplied frontend.
2. Document the existing chat request/response and run/event/evidence contracts. Plan additive, versioned fields for typed follow-up prompts and draft actions; preserve current clients and the frozen AgentResult schema unless an explicit coordinated change is justified.
3. Specify conversation state, grounding references, action draft lifecycle and retention policy. Distinguish UI status from inference_source_mode and financial source_mode.
4. Choose the existing /agent-workspace destination with a reusable coach panel; map all proposed controls to real handlers or unavailable states. Do not introduce a separate visual system.

## Implementation area

docs/CHATBOT_PLAN.md; proposed contracts/coach.ts; src/lib/navigation.ts; existing AppShell and design/frontend-v2 handoffs.

## Acceptance criteria

- [ ] Every chat/run/evidence control has a screen key, API handler and owning task.
- [ ] Preset PDF amounts and agent progress are explicitly excluded from production responses.
- [ ] Proposed API/schema changes are documented for review before implementation; existing contracts are not silently changed.
- [ ] The handoff marks conversational memory/action cards as extensions to the uploaded design, rather than already implemented features.

## Verification

Review a mapping table against the PDF and current API. No provider call is required.

## Pull request handoff

Use a branch such as `feat/fp-25-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
