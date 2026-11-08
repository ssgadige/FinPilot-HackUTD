# FP-34 — Coaching preferences and privacy controls UI

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | A + B |
| Estimate | 2–4 focused hours, excluding review and provider delays |
| Dependencies | FP-28, FP-33 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Coaching preferences and privacy controls UI. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF p.52 settings and p.49 coach inspector; reuse existing settings visual layout.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Expose saved-history opt-in/session-only choice, confirmed coaching priorities and an optional preferred check-in cadence without scheduling notifications.
2. Add clear-history, delete-conversation and reset-coaching-memory controls with an understandable preview of what is removed.
3. Show connected-account scope, snapshot freshness and simulation labels. Reuse current consent/disconnect controls rather than duplicating authorization state.
4. Ensure privacy changes invalidate client caches and pending drafts; do not retain sensitive data in browser localStorage by default.

## Implementation area

src/app/(workspace)/settings/page.tsx; src/components/chat/preferences*; conversation/privacy APIs from FP-28.

## Acceptance criteria

- [ ] Turning saved history off changes persistence behavior and clearly explains treatment of existing saved data.
- [ ] Deletion removes visible messages and associated server summaries/preferences as selected, including after refresh.
- [ ] Confirmed preferences can be edited or revoked; model-inferred preferences are not silently saved.
- [ ] Controls work with keyboard, screen reader labels and mobile layouts.

## Verification

Settings round-trip, cache invalidation, deletion confirmation, two-user privacy and accessible mobile UI tests.

## Pull request handoff

Use a branch such as `feat/fp-34-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
