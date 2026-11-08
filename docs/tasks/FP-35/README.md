# FP-35 — Coach security and conversational quality evaluation

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | B + C |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-28–34 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Coach security and conversational quality evaluation. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.48–50,52 and 57; evidence, partial results, privacy and responsive states.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Create a repeatable conversation evaluation set with expected tool use, missing-data questions, provenance and prohibited actions; use synthetic personas only.
2. Exercise injection through messages, summaries, merchant/offer text, spoofed user IDs, evidence IDs, action drafts and browser-supplied role messages.
3. Test consent revocation during a conversation, expired sessions, cross-user reads/mutations, CSRF, stale snapshot references, token/call/time budgets and idempotent confirmation.
4. Check known-sensitive values never enter model message content, logs, browser bundles or committed files; credentials remain only in the server adapter configuration.
5. Evaluate supportive tone and correction handling separately from deterministic financial/authorization assertions. Label mocked inference as mocked; do not use exact prose matching as a financial correctness test.

## Implementation area

tests/backend/coach-*.test.ts; tests/ui/chat*.test.tsx; conversation evaluation fixtures; scripts/verify-security.mjs.

## Acceptance criteria

- [ ] All financial amount/date/ownership/action assertions pass in the deterministic suite.
- [ ] Malicious history and summary text cannot grant tool capabilities or override current scope.
- [ ] Missing provider configuration and errors remain honest with no mock-success fallback.
- [ ] Known repository lint debt is tracked separately; touched coach files pass required checks without suppressing security/type errors.

## Verification

Run backend/agent/UI tests, typecheck, scoped lint, production build and configured-secret audit; retain sanitized evaluation counts and limitations.

## Pull request handoff

Use a branch such as `feat/fp-35-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
