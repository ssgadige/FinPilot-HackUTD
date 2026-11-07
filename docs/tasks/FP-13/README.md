# FP-13 — Calculation tool library

| Field | Value |
|---|---|
| Workstream | B |
| Estimate | 1 hour |
| Dependencies | FP-09; contracts/types.ts |
| Priority | P0 |

## Scope
Build pure integer-cent cash forecast, recurring detection/normalization, amortization, utilization and bounded stress calculations; provide stable evidence IDs and assumptions.

## Implementation area
src/server/tools/finance

## Acceptance criteria
- [ ] Known payment/interest examples verified.
- [ ] No double-counted transfers or savings.
- [ ] Zero/missing income handled.
- [ ] Tools reject invalid ranges.

## Pull request requirements
- Branch: `feat/fp-13-calculation-tool-library`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #13](https://github.com/ssgadige/FinPilot-HackUTD/issues/13)
