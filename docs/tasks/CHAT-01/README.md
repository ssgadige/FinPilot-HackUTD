# CHAT-01 — Authenticated chat API client

Status: implemented and locally verified. Branch: `feat/chat-01-02-coach-interface`.

The [browser client](../../../src/lib/chat-api.ts) sends only message and optional conversation_id to the existing same-origin POST /api/v1/chat. It uses browser-managed cookies, the verified session's CSRF token, no-store responses and rejected redirects. NVIDIA configuration and user identity are never sent by the UI.

- [x] Typed request/response and runtime response validation.
- [x] Safe mappings for invalid input, expired session, CSRF, rate limit, provider/unavailable/network and malformed responses.
- [x] Caller cancellation, 110-second response deadline and cleanup.
- [x] No automatic retries, particularly when a checkup request may have reached the server.
- [x] Contract verified against the actual authenticated API handler with deterministic tools and mocked inference.

Verification: `npm test`, `npm run test:backend`, `npm run typecheck`, scoped ESLint and production build. Tests cover headers/cookies, conversation continuity, error redaction, malformed response types, timeout/cancellation and expired sessions. Browser tests use only intercepted test responses, not live inference.

The API still handles each message using current records rather than prior conversational turns. Memory belongs to CHAT-05. No backend contract or new dependency was required.
