# Integrate FP-05?08 frontend and verified institution linking

Reviewed main supplied agent services while the frontend still had mismatched DTOs and no institution verification route. This change connects the protected frontend to actual backend envelopes, adds scoped Mailpit institution OTP before preview/consent, restores saved connections, and completes subscription, goal/debt/asset/scenario and run workspace controls. Chatbot implementation is unchanged; its frontend integration remains pending.

Validation: production build/typecheck; 74 component/session tests; 28 backend tests; 25 Chromium/axe tests. Real Chromium/Mailpit journeys against an isolated copy verified selected linking, preference/intention persistence, user isolation, goal editing, server scenarios/evidence, restart persistence, disconnect and logout. Screenshots and detailed acceptance table: `docs/tasks/FP-08/IMPLEMENTATION.md`.

Remaining blockers: local real run start returns 503 ai_unavailable (required NVIDIA_API_KEY/NEMOTRON_MODEL missing; settings preserved); no real proposal for acceptance; teammate chat integration pending. Fixture inference/offer tests are labeled and do not prove live inference or merchant availability. Full repository lint retains inherited debt (104 errors, one warning); changed-file diagnostics checked without suppressions. No DB, local configuration, credentials or mailbox/runtime artifacts included.

References #5, #6, #7, #8. These references do not close incomplete issues. Request review; do not merge.
