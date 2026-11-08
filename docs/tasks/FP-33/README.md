# FP-33 — User-requested check-ins and coaching progress

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | B + C + A |
| Estimate | 3–5 focused hours, excluding review and provider delays |
| Dependencies | FP-29, FP-32 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

User-requested check-ins and coaching progress. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

Extend PDF p.49 coaching cards and pp.35/52 goals/settings; these check-in screens are new scope.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Add a user-requested weekly review with one or two supported next steps, comparison to the prior compatible check-in and clear missing-data handling.
2. Store progress states separately: suggested, user committed, user reports completed, and verified by records. Only trusted deterministic evidence can create the last state.
3. Explain goal progress from actual saved/contribution records. Do not update saved_cents or mark subscription savings realized because the user checked a box.
4. Provide a lightweight progress/check-in view in the coach. Background schedules, push notifications and email reminders are deferred; no messages are sent automatically.

## Implementation area

Scoped coaching progress/check-in tables and services; coach cards; goal-progress calculation integration.

## Acceptance criteria

- [ ] A user-reported completion remains self-reported until supported by records.
- [ ] The coach distinguishes changed records from old snapshot comparisons.
- [ ] Missing new data produces an honest review rather than invented improvement.
- [ ] Check-ins and progress records are owner-scoped, deletable and integrated with the chosen retention policy.

## Verification

Evidence-based verification transitions, two-user isolation, missing-data check-ins and deletion/retention tests.

## Pull request handoff

Use a branch such as `feat/fp-33-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
