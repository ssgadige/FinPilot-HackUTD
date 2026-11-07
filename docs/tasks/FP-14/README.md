# FP-14 — Goals subscriptions plans and versioning APIs

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 1.5 hours |
| Dependencies | FP-09/10/13 |
| Priority | P0 |

## Scope
Implement scoped CRUD, preference/actions, proposal persistence, optimistic version acceptance and explicit confirmation. Atomic accepted-plan update; no real financial transactions.

## Implementation area
src/app/api/v1/goals, subscriptions, plans, scenarios

## Acceptance criteria
- [ ] Two simultaneous accepts return one success/one conflict.
- [ ] Action intention not realized savings.
- [ ] Accepted plan preserved on failed revision.
- [ ] Ownership verified.

## Pull request requirements
- Branch: `feat/fp-14-goals-subscriptions-plans-and-versioning-apis`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #14](https://github.com/ssgadige/FinPilot-HackUTD/issues/14)
