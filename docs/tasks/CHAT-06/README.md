# CHAT-06 — Final local coach integration and polish

Status: complete for local mocked-inference acceptance. Live NVIDIA quality, a deployed production browser journey and the full sponsor rehearsal remain separate, unperformed checks.

## Acceptance coverage

- [x] Combined real authenticated HTTP-handler journey: password → email code → simulator consent/link → chat → follow-up context → evidence → checkup/events → cancellation → provider failure → logout.
- [x] Real SQLite ownership and snapshot checks; another user cannot open the first user's evidence.
- [x] Two independent browser contexts show only their own transcripts. Logout clears user A's UI without affecting user B. A subsequent identity does not inherit A's transcript.
- [x] Expired chat sessions hide the entire coach and do not retry the rejected message.
- [x] Evidence focus return/Escape, safe text rendering, Enter submission, mobile layout, horizontal overflow and automated contrast/accessibility checks.
- [x] Ambiguous run creation retries reuse the request key; actual role/event states and cancellation are displayed honestly.
- [x] Bounded conversation context, new-conversation resets and stale-snapshot answer hiding are verified.
- [x] Provider failures, inaccessible evidence, cancelled/stale/partial runs and session errors have explicit states.
- [x] Backend, agent, UI, browser, type/build and configured-secret checks pass.

## Results

See [local acceptance](local-acceptance.json): 34 backend tests, 78 agent tests, 97 UI tests and seven browser tests. The combined API journey invokes the real handler/auth/simulator/finance/run/evidence services with real temporary SQLite and controlled inference. Local SMTP has a separate real test receiver. Browser journeys use the isolated component harness with intercepted authentication/API responses, not a bypass in deployed application routes.

The browser fixture cannot establish live model quality or prove that all production pages work together against a deployed server. No NVIDIA calls or public offer retrieval were performed. Existing repository-wide lint debt remains; changed coach/test files pass scoped lint. Docker runtime and a full live three-minute judging rehearsal are not claimed.

## Reproduce

```sh
npm run test:backend
npm run test:agents
npm test
npm run typecheck
npm run build
npm run verify:security
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npx playwright test --config tests/browser/playwright.coach.config.ts
```

Omit the channel setting if Playwright Chromium is installed. All automated model responses above are controlled doubles. Browser screenshots remain explicitly labeled fixtures:

- [Coach desktop](../CHAT-02/evidence/coach-fixture-1440.png) / [mobile](../CHAT-02/evidence/coach-fixture-390.png)
- [Evidence desktop](../CHAT-03/evidence/source-fixture-1440.png) / [mobile](../CHAT-03/evidence/source-fixture-390.png)
- [Run desktop](../CHAT-04/evidence/run-fixture-1440.png) / [mobile](../CHAT-04/evidence/run-fixture-390.png)
- [Context desktop](../CHAT-05/evidence/context-fixture-1440.png) / [mobile](../CHAT-05/evidence/context-fixture-390.png)

## Handoff

Restart the dev server to load updated backend services, sign in with the generated fictional credentials and open `/agent-workspace`. Missing model configuration must show unavailable state. Actual live conversations send synthetic financial context to NVIDIA and still require separate authorization under the current local-only instruction.

CHAT-01–06 are locally accepted. Saved history, long-term coaching preferences, confirmed goal/plan action cards, complete general planning mappings and remaining advanced screens are outside the two-hour MVP. Publishing these pending changes requires the user's separate commit/push/PR request.
