# FP-30 — Application planning account mappings and monthly semantics

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | B + C |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-25; existing FP-14/20/21 tools |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Application planning account mappings and monthly semantics. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.35–38 and 40–42; goals, goal-editor, plan-compare, accept-plan, scenario-lab, stress-result, plan-repair.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Add explicit owned goal funding accounts, debt payment accounts/dates and protected cash buffer inputs, with migrations and validation.
2. Define conversion between application monthly plans and specialist horizon-based allocations. Preserve scheduled minimums, bills, goal earmarks and reserves exactly once.
3. Extend BackendAgentBridge with genuine debt/goal/stress capabilities only when required mappings exist. Continue needs-information responses for unmapped legacy records.
4. Provide the smallest account/date/goal form inputs required by the coach, reusing the supplied goal-editor and plan-compare design instead of rebuilding every FP-06 screen.

## Implementation area

src/server/db migrations; src/server/planning.ts; src/server/agents/integration/backend.ts; planning/stress tools; minimal goal-editor components.

## Acceptance criteria

- [ ] Cross-user or disconnected funding/payment accounts reject.
- [ ] No cash or existing goal savings are allocated twice; monthly/horizon boundary examples reconcile to the cent.
- [ ] Unknown APR, limits, dates or account mappings never silently become zero/default facts.
- [ ] Application records can reach debt → goals → stress tools, with explicit skips if the existing global call budget cannot cover a full chain.

## Verification

Conservation, date rollover, missing metadata, disconnected accounts, old-record migrations and current-snapshot integration tests.

## Pull request handoff

Use a branch such as `feat/fp-30-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
