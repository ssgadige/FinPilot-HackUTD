# FP-36 — End-to-end coach journey and design acceptance

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | A + B + C |
| Estimate | 4–6 focused hours, excluding review and provider delays |
| Dependencies | FP-27, FP-32, FP-34, FP-35 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

End-to-end coach journey and design acceptance. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF pp.35–42,46–50,52,57; complete user journey across the supplied screen family.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Verify two isolated fictional users through login → selected account linking → conversation → checkup/evidence → goal clarification → scenario/plan preview → explicit acceptance → changed-data revision.
2. Test refresh/resume, logout/account switch, deletion, mobile keyboard flow, cancellation, partial provider failure and disconnected data.
3. Capture 1440px desktop and 390px mobile screenshots matched to the supplied PDF/v2 screen keys; check focus, 200% zoom and non-color status labels.
4. Keep local mocked integration acceptance and real live inference acceptance as separate reports. Honor the current local-only instruction; request new explicit authorization before any future external rehearsal.
5. When authorized later, measure the actual three-minute sponsor/demo journey and retain sanitized provenance; provide clearly labeled cached replay, never fabricated live success.

## Implementation area

tests/e2e/coach.spec.ts; docs/DEMO.md; task-specific screenshot/evidence directory; acceptance records.

## Acceptance criteria

- [ ] Two-user browser journeys complete without cross-user cached state or duplicate mutations.
- [ ] Every primary coach action works or is explicitly unavailable; no PDF sample result is presented as a calculation.
- [ ] Backend, agent, UI, type/build and security checks pass for the final combined implementation.
- [ ] Release notes distinguish local acceptance, pending live acceptance, remaining product screens and unsupported capabilities.

## Verification

Browser-level acceptance with controlled inference doubles first. Live NVIDIA verification remains pending unless separately authorized.

## Pull request handoff

Use a branch such as `feat/fp-36-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
