# FP-26 — Responsive chatbot interface and authenticated API client

| Field | Value |
|---|---|
| Status | Planned — not implemented by this task-generation change |
| Workstream | A |
| Estimate | 3–4 focused hours, excluding review and provider delays |
| Dependencies | FP-25 |
| GitHub issue | Not created; task ID is not a GitHub issue number |

## User outcome

Responsive chatbot interface and authenticated API client. See the [coach roadmap](../../CHATBOT_PLAN.md) for delivery order and existing capabilities to reuse.

## Uploaded frontend handoff

PDF p.49 chat and p.57 mobile-agents; reuse FP-08 responsive/empty states.

Source: repository-root `FinPilot_All_Screens_and_Task_Guide.pdf` (85 pages), supplied by the user. Its pages are static reference states, not a working frontend implementation. The tracked [v2 screen manifest](../../../design/frontend-v2/screens.json) supplies matching keys; [v2 handoff](../../../design/frontend-v2/README.md) supersedes the earlier SVG set. Keep existing AppShell/shared components and source labels. Added coaching states extend the reference rather than replacing it.

## Scope and deliverables

1. Build reusable conversation, message, composer, suggestion and retry components using the existing shared UI. Add an Ask FinPilot entry point and an accessible mobile panel.
2. Create a typed chat client using the existing verified-session/CSRF conventions and POST /api/v1/chat. Preserve conversation_id for this user only; abort UI requests and clear state on logout/account switch.
3. Display reply text safely, source badges and evidence links. A processing indicator reflects an actual request; initial implementation can use non-streaming JSON.
4. Support empty, submitting, completed, expired-session, rate-limited, unavailable and failed states. Never replace an unavailable model with a scripted successful answer.

## Implementation area

src/components/chat/*; src/lib/chat-api.ts; src/components/app-shell.tsx; tests/ui/chat.test.tsx.

## Acceptance criteria

- [ ] A sent message reaches the real authenticated handler; response text is rendered without model HTML execution.
- [ ] Keyboard submission, labeled input, focus return, scrolling and 390px/1440px layouts work.
- [ ] User A messages cannot appear in user B UI after switching users.
- [ ] Retry cannot accidentally repeat a mutation or duplicate a requested run; before request idempotency is available, ambiguous run requests require checking existing activity instead of blind resubmission.

## Verification

UI tests with mocked HTTP, plus integration against the local authenticated handler. Capture desktop/mobile screenshots.

## Pull request handoff

Use a branch such as `feat/fp-26-conversational-coach`. Link this task and the eventual assigned issue; do not invent issue numbers. Include relevant tests and source/fixture labels, plus desktop/mobile screenshots for UI work. Request review before merge. Dependencies must be merged or clearly stacked. Contract/data migrations need a coordinated handoff and backward compatibility. Existing FP-07/08 scopes are implemented by the mapped subtasks, not duplicated as competing changes.

Read [API](../../API.md), [security](../../SECURITY.md) and [agent contracts](../../../contracts/types.ts) before implementation. No credentials/OTPs in prompts, logs or artifacts; no model-granted execution permission. No new frameworks, vector database or document-RAG service is required for this roadmap.
