# FP-29 — Conversational coaching dialogue and preference discovery

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | C + A |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-28 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Conversational coaching dialogue and preference discovery. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF p.49; new coaching states extend its Conversation and Basic chat scope cards.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Build Nemotron coaching behavior for explaining finances, clarifying goals and helping choose a next step. Ask one focused question when essential information is missing.
2. Track a typed, server-owned discussion state: topic, referenced goal/finding, missing fields and user-confirmed preferences. Let users correct or abandon a topic.
3. Support greeting, explanation, clarification and read-only planning intent with minimal necessary retrieval. Define a safe no-financial-claim small-talk path rather than forcing all financial tools for every greeting.
4. Use clear, respectful, non-judgmental language; separate known facts, user statements, calculated scenarios and uncertainty. Persist important preferences only after confirmation.
5. Return structured suggested replies alongside grounded text via the reviewed additive contract. No tool or action permission may be granted by the model itself.

## Implementation area

src/server/agents/chat.md; src/server/agents/chat/index.ts; coach dialogue/state helpers; src/components/chat/*.

## Acceptance criteria

- [ ] Coach handles follow-ups, corrections, topic switches and missing data without inventing amounts.
- [ ] Each financial numerical claim is supported by current tool evidence; unsupported estimates are labeled or withheld.
- [ ] “Do not run a checkup” and hypothetical examples never start work.
- [ ] No stale summary or conversation instruction can bypass identity, evidence or confirmation checks.

## Verification

A fixed conversation evaluation suite for greetings, pronouns, corrections, ambiguous amounts, negative requests, missing data and stale snapshots.

## Pull request handoff

Use a branch such as `feat/fp-29-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
