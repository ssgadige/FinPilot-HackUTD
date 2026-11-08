# CHAT-02 — Responsive coach interface

Status: implemented and locally verified. Branch: `feat/chat-01-02-coach-interface`.

Open `/agent-workspace` after password/email verification, or choose **Ask FinPilot** in the desktop header / **Agent workspace** in navigation. The route retains the existing server-side verified-session guard.

The [coach panel](../../../src/components/chat/coach-panel.tsx), [message list](../../../src/components/chat/message-list.tsx) and [composer](../../../src/components/chat/message-composer.tsx) reuse the existing AppShell and cards/buttons. Layout follows the supplied `FinPilot_All_Screens_and_Task_Guide.pdf` page 49 and stacks at mobile widths, consistent with page 57. The upload is preserved unchanged.

- [x] Conversation, suggested questions, labeled composer, 2,000-character limit and request-only progress.
- [x] Enter submission, Shift+Enter newline, IME composition handling, focus return and transcript scrolling.
- [x] Duplicate-send guard, safe text rendering and explicit provider/error states.
- [x] Rate-limit cooldown and session/CSRF protection.
- [x] Conversation ID retained only in component memory; transcript cleared and outstanding requests aborted on user switch/logout/unmount.
- [x] Late responses from a previous user cannot repopulate the transcript.
- [x] Financial-data/inference labels and returned run reference, without fabricated progress.
- [x] New conversation resets the local transcript; it does not claim to delete server records.
- [x] 1440px desktop / 390px mobile overflow and automated accessibility checks.

## Evidence and reproduction

- [Desktop browser fixture](evidence/coach-fixture-1440.png)
- [Mobile browser fixture](evidence/coach-fixture-390.png)
- [Local acceptance record](local-acceptance.json)

Screenshots use the isolated test harness and clearly marked mocked responses. The application route and its authentication guard are not replaced by that harness.

```sh
npm test
npm run test:backend
npm run typecheck
npm run build
npm run verify:security
npx playwright test --config tests/browser/playwright.coach.config.ts
```

The browser command uses installed Playwright Chromium by default. If local Chrome is installed, use `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test --config tests/browser/playwright.coach.config.ts`. The test harness binds only localhost and does not use NVIDIA.

The larger UI suite exposed an existing initial-session race: FinanceScope showed an unauthenticated error while authentication was still checking. It now shows a loading state, keeping records hidden until verification resolves. The backend secret test also no longer mistakes the public demo password substring `123` inside legitimate amounts/hashed IDs for a secret leak; high-entropy credentials and forbidden authentication fields remain checked.

Follow-up: CHAT-03 evidence and CHAT-04 run controls are now implemented and locally verified. CHAT-05 now adds bounded session-only conversation context; see its implementation notes for retention and reset behavior. This screen does not complete the broader FP-07 agent workspace. Live provider verification remains pending under the user's local-only instruction. No commit/push/PR is included in this implementation request.
