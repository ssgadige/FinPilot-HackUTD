# FP-31 — Grounded coach tools for scenarios and agent workflow handoffs

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | B + C |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-27, FP-29, FP-30 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Grounded coach tools for scenarios and agent workflow handoffs. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.37,40–42,46–50; plan comparison, scenarios, repair and chat handoffs.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Add narrowly scoped reads/calculations for current cash, upcoming bills, selected transactions, subscriptions, goals, plans and scenarios. Use existing deterministic finance services.
2. Let the coach interpret a requested what-if and return a calculated hypothetical preview with assumptions and evidence; a scenario is not a recorded expense.
3. Add flexible natural-language workflow intent through typed server-validated requests. Explicit UI confirmation or a well-defined server authorization policy grants run capability; LLM classification alone cannot grant it.
4. Avoid starting a complete multi-specialist checkup for each message. Reuse compatible owned findings, label stale/unavailable sources and expose call/budget outcomes.
5. Ensure scenario/plan context is the same between coach, evidence drawer and feature screens. Keep read tools separate from execution endpoints.

## Implementation area

src/server/agents/chat/index.ts; tool allowlists; src/server/runs/index.ts; existing Finance/Planning services and scenario tools.

## Acceptance criteria

- [ ] A delayed-paycheck or surprise-expense question uses actual calculated dates/cents and does not mutate the ledger.
- [ ] Explaining an existing finding performs no hidden new checkup.
- [ ] Repeated approved workflow requests have a stable idempotency identity and no duplicate model runs.
- [ ] Budget exhaustion, provider timeout and missing capabilities produce explicit partial/unavailable outcomes.

## Verification

Tool-schema/identity tests, counterfactual-versus-recorded-event tests, numerical grounding, duplicate run requests and budget/failure tests.

## Pull request handoff

Use a branch such as `feat/fp-31-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
