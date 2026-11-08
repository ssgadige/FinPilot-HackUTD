# Integration verification (FP-24)

## Current acceptance status

Local verification passes for the coordinator, evidence gate, chat, durable repair and consent-scoped backend bridge. Agent tests use mocked inference; this must never be presented as live Nemotron evidence. Historical live specialist traces remain in their respective directories, including Plan Repair. No successful full integration acceptance artifact has been produced.

The user selected **local tests only** for this work. Do not run `npm run demo:agents` without later authorization to send synthetic fixture data to NVIDIA and retrieve public offers.

## Application boundaries

Frontend/authentication/finance functionality is present on upstream `56203bb` and has been separately tested. FP-15 `/runs`, `/chat` and demo-event handlers are now implemented and locally verified. The FP-07 agent workspace remains a placeholder. This lane supplies server services and a consent-scoped bridge; it does not claim an end-to-end browser journey.

The backend lacks explicit goal funding accounts and debt payment account/date mappings. The bridge returns unavailable planning/stress capabilities rather than fabricating these. Explicit planning/stress fixture snapshots remain runnable through specialist services. The standalone repair fixture retains its own store. FP-15 also supplies a conservative monthly application-plan adapter that requires confirmation and discloses missing metadata.

All eight specialists have runtime roles and deterministic tools. Routine checkups route seven via their dependency graph; repair is event-only. Each checkup has 24 provider calls, so full-route execution may skip later roles with reasons. Sponsor acceptance of the public external offer source requires confirmation outside this code.

## Reproduction

- `npm run typecheck`
- `npm run test:agents` — runtime, adapter, calculation and agent security tests.
- `npm run test:backend` — real SQLite, consent/disconnect and local SMTP tests.
- `npm test` and `npm run build` — application checks.
- `npm run demo:agents:replay` — offline, explicitly cached historical evidence when no complete integration record exists. It performs zero provider calls.

With future explicit live-data authorization, `npm run demo:agents` uses temporary synthetic seed storage, reruns three personas, expense repair/replay, grounded chat, injected budget exhaustion and public offer retrieval. It retains sanitized trace/source labels only on successful completion and measures its actual duration. Provider failures are partial results, not success. It never claims the missing application journey passed, even when the CLI passes. A measured CLI rehearsal and the full browser rehearsal are separate checks.

## Recorded local checks

[Local acceptance record](local-acceptance.json): 78 agent tests, 24 backend tests and 51 UI tests pass; TypeScript and production build pass. New FP-22–24 files pass scoped ESLint. Repository-wide ESLint still reports 105 explicit-`any` errors and one unused-binding warning in existing runtime/backend/scripts/tests; this is not a clean repository lint pass.
