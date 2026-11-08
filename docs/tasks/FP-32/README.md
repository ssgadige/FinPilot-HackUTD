# FP-32 — Reviewable coach action cards and confirmed execution

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | A + B + C |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-26, FP-30, FP-31 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Reviewable coach action cards and confirmed execution. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.36–38,42,49; goal-editor, plan-compare, accept-plan, plan-repair and decision inspector.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Create typed server-owned drafts for goal create/update, scenario request and proposed plan selection/acceptance. Keep demo-event recording a separate, clearly simulated explicit action.
2. Render structured action cards with summary, full inputs, source snapshot, assumptions, consequences and Confirm/Edit/Dismiss controls.
3. Bind draft owner, version, expiration and payload fingerprint. Revalidate consent, snapshot and expected plan version on confirmation, using existing validated services.
4. Implement atomic single-effect execution and idempotent retries; do not simply retry non-idempotent goal creation. Preview never writes a goal or accepts a plan.
5. The model may draft allowed fields but cannot forge confirmation, choose user identity, mark a task verified or execute a purchase/transfer/cancellation.

## Implementation area

contracts/coach.ts draft types; scoped draft migration/API; src/components/chat/action-card.tsx; existing Planning acceptance services.

## Acceptance criteria

- [ ] Chat text such as “yes” cannot accept an unidentified or expired action.
- [ ] Double-click/retry produces one goal or one acceptance, and conflicts require a fresh preview.
- [ ] Stale, foreign or altered drafts reject without changing the accepted baseline.
- [ ] Before/after values and requires-confirmation remain visible; cancellation/dismissal leaves financial records unchanged.

## Verification

Concurrency, transaction rollback, CSRF, double-submit, stale-version, payload-tampering and cross-user mutation tests; screenshot confirmation states.

## Pull request handoff

Use a branch such as `feat/fp-32-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
