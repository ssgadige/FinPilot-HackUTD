# 14-hour plan — three people, 42 person-hours

This is an aggressive prototype scope, not a promise to ship a production bank. Each lane totals exactly 14 planned hours including 3.5 hours for integration/verification. The estimate assumes three active developers and coding assistance. Critical blockers are real Nemotron access, local Node/SQLite compatibility and email verification.

| Elapsed window | A — frontend | B — backend/security | C — agents/integration |
|---|---|---|---|
| 0–1 | App scaffold, layout and contracts | Database and seed review | Confirm Nemotron model/tool call |
| 1–3 | Login/linking UI | Password/email challenge and sessions | Shared tool loop + integrity/cash agents |
| 3–6 | Overview/history/cash UI; integrate early | Simulator + authorized data APIs | Subscriptions/deals + debt/goals |
| 6–8 | Subscriptions/goals/scenario screens | Calculation and plan endpoints | Stress tests + repair |
| 8–10.5 | Agent workspace/basic chat | Events, security checks | Coordinator/evidence/chat integration |
| 10.5–12 | All lanes: end-to-end integration and failure fixes | All lanes | All lanes |
| 12–13 | All lanes: auth/ownership tests, calculations, seeded journeys | All lanes | All lanes |
| 13–14 | Freeze features, rehearse, capture screenshots/trace and backup | All lanes | All lanes |

Each task README contains tighter ownership, dependencies and acceptance criteria. Shared schema/API freeze in hour 1. Merge every 60–90 minutes. A builds from response contracts while B implements endpoints. C works against the same tool contracts; no duplicate database access code.

## Stop/go gates

- Hour 2: real Nemotron model can select a tool and consume its result. If blocked, resolve access immediately, do not build fake agents.
- Hour 3: password + email verification + scoped session works. Use local Mailpit if external sender setup is blocked.
- Hour 6: working login → simulated link → dashboard → actual agent result with evidence.
- Hour 10.5: feature freeze; eight specialists wired. If behind, finish the strongest connected specialists and mark remaining roles unavailable; never claim unwired cards work.
- Hour 12: mandatory ownership/auth tests pass. If they fail, keep demo local and synthetic while fixing; no public deployment.

## Cut order if behind

1. Public hosting (local demo first), animations, exports, custom logos.
2. Streaming responses/SSE; use polling.
3. Deep investment/retirement/CD planning; retain snapshots/maturity data.
4. Complex live offer parsing; keep one real allowlisted source plus labeled comparable sample offers.
5. Extra specialists outside the eight. Never cut account isolation, verification gates, arithmetic correctness or evidence labels.

## Pitch and judging

PNC: whole picture across accounts, three transparent health indicators, forecast and what-if decisions.
NVIDIA: actual Nemotron specialist tool calls, dependency handoffs, external service interaction, and event-driven repair. More agents alone is not the value; show the outcome each contributed.
