# FP-28 — Private bounded conversation memory and conversation APIs

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | B + C |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-25, FP-26 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Private bounded conversation memory and conversation APIs. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

Extend PDF p.49 conversation; settings/privacy uses p.52 settings.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Add owned conversation list/read/delete and bounded message-history support through additive contracts. Reauthorize conversation, selected accounts and snapshot on every turn.
2. Define session-only mode and explicit opt-in saved history. Proposed saved-history policy: at most 20 sanitized recent turns plus a bounded summary, 30-day expiry; document the final decision in FP-25 before migration. Existing assistant-only storage does not constitute multi-turn memory.
3. Screen sensitive input before persistence or inference, minimize financial payloads, and exclude conversation content from analytics/logs. Do not trust browser-supplied assistant/system messages.
4. Separate user claims, confirmed preferences and verified financial facts. Summaries contain provenance/references and are untrusted context, never authorization. Refresh monetary facts from the current snapshot.
5. Delete history, summaries, derived coaching state and pending drafts together. Handle old assistant-only records explicitly; clear ephemeral context on logout, and define restart behavior.

## Implementation area

src/server/runs/index.ts; src/server/agents/chat/index.ts; src/server/db migrations; contracts/coach.ts; tests/backend/coach-memory.test.ts.

## Acceptance criteria

- [ ] “I want a car” → “How much?” → “$10,000” resolves the same discussion within the bounded context.
- [ ] Forged conversation IDs and client-injected privileged messages are rejected.
- [ ] Opt-out, expiry and deletion remove retained derived context; switching users never shares memory.
- [ ] Snapshot changes invalidate cached numerical facts without turning an old user claim into a verified balance.

## Verification

Two-user read/write/delete, retention clock, restart, sensitive-input and prompt-injection tests. Inference remains mocked for local acceptance.

## Pull request handoff

Use a branch such as `feat/fp-28-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
