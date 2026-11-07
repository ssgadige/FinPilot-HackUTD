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
- [ ] Price/terms evidence attached.
- [ ] Annual upfront/promo eligibility handled.
- [ ] Unverified/no comparable offer returns uncertainty.
- [ ] Failed fetch never labeled live.
- [ ] No arbitrary URL or purchase tool.

## Pull request requirements
- Branch: `feat/fp-19-subscription-and-deal-scout-agents-with-source-adapter`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #19](https://github.com/ssgadige/FinPilot-HackUTD/issues/19)
