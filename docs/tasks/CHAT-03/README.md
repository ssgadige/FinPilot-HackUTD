# CHAT-03 — Evidence and grounded explanations

Status: implemented and locally verified.

- [x] Answer and finding evidence buttons open the authenticated source endpoint.
- [x] Shared evidence dialog preserves keyboard dismissal, focus return and responsive drawer layout.
- [x] Source, observed timestamp, snapshot version, source mode, calculated cents/dates and assumptions are shown as inert text.
- [x] Ask about this finding sends a scoped reference without starting a checkup.
- [x] Sources link back to their originating persisted run.
- [x] Stale, disconnected, foreign or unavailable evidence fails closed. Previous answers are hidden when their source becomes inaccessible or a finance invalidation event arrives.
- [x] Chat-generated evidence is now persisted atomically with an owned snapshot run; inherited evidence retains its original run. No raw user message or hidden reasoning is stored in the evidence record.

Implementation: src/components/chat/evidence-drawer.tsx, shared src/components/ui/evidence-dialog.tsx, src/lib/runs-api.ts, src/server/runs/index.ts and Store.evidence. Existing account/transaction evidence uses the same dialog shell.

Verification: 91 UI tests, 25 backend tests and four browser tests pass across CHAT-01–04. Browser tests use mocked authenticated responses and local Chrome; backend tests use real SQLite/handlers with mocked inference. TypeScript, production build and scoped lint pass. No live NVIDIA verification was performed.

[Desktop evidence](evidence/source-fixture-1440.png) · [Mobile evidence](evidence/source-fixture-390.png) · [Combined acceptance](../CHAT-04/local-acceptance.json).

The screenshots are explicitly labeled test fixtures. CHAT-05 now adds bounded session context; saved history remains deferred.
