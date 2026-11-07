# FP-05 — Subscription manager and offer comparison

| Field | Value |
|---|---|
| Workstream | A |
| Estimate | 1.5 hours |
| Dependencies | FP-01; FP-13; FP-19 |
| Priority | P0 |

## Scope
Show recurring candidates, confidence, price changes, preference confirmation and comparable offers. Distinguish fixture/live, promotional/renewal prices, annual upfront charges and intention vs confirmed change.

## Implementation area
src/app/subscriptions

## Acceptance criteria
- [ ] User can confirm preferences and save proposed action.
- [ ] Sample offer badge visible.
- [ ] No fabricated unused claim.
- [ ] No cancellation/purchase performed.

## Interface requirements
Implement the screen requirements in [UI design specification](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/UI_DESIGN.md). Use the shared banking visual system, responsive layouts, readable financial tables, accessible forms and complete loading/empty/error states. Include desktop and mobile screenshots in the PR.

## Pull request requirements
- Branch: `feat/fp-05-subscription-manager-and-offer-comparison`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #5](https://github.com/ssgadige/FinPilot-HackUTD/issues/5)
