# FP-19 — Subscription and deal scout agents with source adapter

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 1.5 hours |
| Dependencies | FP-17/18; merchant and offer tools |
| Priority | P0 |

## Scope
Wire recurring candidates and preferences into Subscription Detective, then Deal Scout. Implement one allowlisted external public offer retrieval with provenance; labeled fixture fallback; comparable cost tool.

## Implementation area
src/server/agents/subscriptions, deals, src/server/offers

## Acceptance criteria
- [x] Price/terms evidence attached.
- [x] Annual upfront/promo eligibility handled.
- [x] Unverified/no comparable offer returns uncertainty.
- [x] Failed fetch never labeled live.
- [x] No arbitrary URL or purchase tool.

## Acceptance evidence

Live public pricing retrieval and live Nemotron verification passed with labeled
fixture finances: eight model calls, six actual tools, 12.705 seconds total.
Subscription Detective reported the fixture price increase from $15.99 to $19.99.
Deal Scout consumed that dependency and compared the retrieved standard renewal
price with explicit features, eligibility and promo exclusion. Potential savings
were correctly formatted as $7.00/month ($84.00/year); realized savings stayed $0.

- [Actual source retrieval, model results and tool trace](../../../src/server/offers/acceptance.json)
- [Configuration, verification commands, assumptions and integration boundary](../../../src/server/offers/README.md)
- Tests cover recurrence, annual upfront/normalization, eligibility, unavailable
  and fixture sources, immutable scoped runtime, cross-user/disconnect rejection,
  SSRF and DNS pinning, redirect/size/timeout rejection, unknown/purchase tools,
  and prevention of cent-to-dollar formatting errors.

The authenticated backend loader, storage/routes and broader FP-13 finance library
remain separate integration work. No production database integration is claimed.

## Pull request requirements
- Branch: `feat/fp-19-subscription-and-deal-scout-agents-with-source-adapter`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #19](https://github.com/ssgadige/FinPilot-HackUTD/issues/19)
