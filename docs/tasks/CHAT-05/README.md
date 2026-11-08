# CHAT-05 — Bounded session conversation context

Status: implemented and locally verified. Branch: `feat/chat-05-session-context`.

## Behavior

The coach receives up to three recent successful exchanges (six messages) and an optional validated finding reference. This context is scoped to the verified user, authenticated session and conversation. Follow-ups such as “Which bill caused it?” can resolve their topic from recent discussion; current financial facts still come from fresh tools.

- [x] Server-owned RAM cache; no browser-provided history or privileged message roles accepted.
- [x] At most six messages, 700 characters per retained message and a 5,500-character serialized context budget. Oldest full exchanges are dropped first.
- [x] Fifteen-minute inactivity expiry, at most five remembered conversations per session and 200 per process. A minute-based unreferenced timer removes expired/revoked entries; reads enforce expiry immediately.
- [x] Snapshot/account-scope changes discard previous context and source references. Unavailable selected evidence clears context before inference.
- [x] Logout clears that session's context and aborts pending chat replies. A new or second active session cannot read another session's memory, even for the same user/conversation ID.
- [x] Failed replies are not remembered. Same-conversation concurrent submissions reject rather than mixing turn order.
- [x] Contact details are minimized; credential-shaped input, configured secrets and active session values are screened before inference/memory. Sensitive response failures are not treated as successful replies.
- [x] Previous turns are encoded as untrusted user-data context, never system/assistant authority, financial evidence or tool permission. Current tools, evidence validation and the original call/time budgets remain required.
- [x] Existing explicit-action policy applies only to the latest message. Remembering an earlier checkup request does not authorize another one.
- [x] UI shows context bounds and reset notices; old financial answers are hidden after a changed snapshot. New conversation starts a fresh discussion.

## Files and API

- `src/server/agents/chat/memory.ts`: volatile cache, bounds, expiry and text screening.
- `src/server/agents/chat/index.ts`, `chat.md`, `runtime/index.ts`: bounded untrusted context and current-tool grounding.
- `src/server/runs/index.ts`, `api.ts`: verified-session binding, ownership, logout/abort and successful-turn retention.
- `src/lib/chat-api.ts`, `src/components/chat/coach-panel.tsx`: validated additive response metadata and context UI.

POST /chat still accepts only message and optional conversation_id. The additive response context contains mode=session_only, retained_turns, max_turns=6, expires_after_seconds=900, snapshot_version and reset reason. No session key or owner identity is exposed in this metadata. The frozen AgentResult schema is unchanged.

No database migration was required. Raw user turns and the conversational context are not persisted to SQLite, localStorage or sessionStorage. Existing assistant-reply and financial-evidence audit records remain under their existing persistence behavior; clearing temporary context does not delete those records. A server restart loses conversational memory while preserving the existing financial/audit database. An owned persisted conversation ID can be reused after restart, but it starts with empty context.

## Verification

- 34 backend tests, including real authenticated handlers/SQLite and mocked inference: follow-up handoff, selected references, contact minimization, cross-user/session isolation, active parallel sessions, inactivity, snapshot resets, logout during inference, failed/concurrent turns, past-action injection and unsupported remembered monetary claims.
- 78 agent tests and 97 UI tests pass.
- Five mocked browser tests pass, including context indicators, follow-ups, new-conversation reset, changed-snapshot answer hiding, mobile/desktop layout and automated accessibility.
- TypeScript, scoped lint, production build and configured-secret scans pass.

[Desktop conversation fixture](evidence/context-fixture-1440.png) · [Mobile conversation fixture](evidence/context-fixture-390.png) · [Acceptance record](local-acceptance.json).

```sh
npm run test:backend
npm run test:agents
npm test
npm run typecheck
npm run build
npm run verify:security
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test --config tests/browser/playwright.coach.config.ts
```

All inference verification is mocked, following the user's local-only instruction. No fresh live NVIDIA conversation-quality acceptance is claimed. Saved-history APIs, long-term preferences, summaries, RAG and goal/action execution remain outside this MVP. User-provided amounts remain claims and cannot alone support assertions about available money. Restart an already-running dev server to load the updated backend singleton, then open `/agent-workspace`.
