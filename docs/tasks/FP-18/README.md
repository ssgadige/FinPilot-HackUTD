# FP-18 — Bounded agent runtime integrity and cash agents

| Field | Value |
|---|---|
| Workstream | C |
| Estimate | 2 hours |
| Dependencies | FP-17; FP-13 contract |
| Priority | P0 |

## Scope
Implement shared validated tool loop, role allowlists, result validation, events and budgets. Wire Data Integrity and Cash Collision prompts to real tools.

## Implementation area
src/server/agents/runtime, integrity, cash

## Acceptance criteria
- [x] Actual tool trace.
- [x] Integrity catches transfer/data issues.
- [x] Cash identifies a dated collision from tools.
- [x] Malformed result retry bounded.
- [x] Ownership context immutable.

## Acceptance evidence

Live Nemotron verification passed using clearly labeled synthetic financial data:
8 model calls, 6 actual tool executions, 32.774 seconds total. Integrity detected
stale savings, a duplicate transaction ID, two reconciliation mismatches and an
unmatched transfer. Cash identified checking at -70000 cents on 2026-11-10 despite
positive combined cash, consuming the integrity result for the same server context.

- [Recorded live trace and results](../../../src/server/agents/runtime/acceptance.json)
- [Runtime, integration boundary and verification commands](../../../src/server/agents/runtime/README.md)
- `node --test tests/agent-runtime.test.ts tests/nemotron.test.ts`: 24 tests passed,
  including exactly one malformed-result repair, immutable context, cross-user
  rejection, disconnect, invalid tools/arguments, evidence and amount validation,
  budgets, cancellation and deadlines.

The authenticated backend and FP-13 library are not implemented in this checkout.
The runtime supplies deterministic snapshot tools and an explicit authorized
`SnapshotLoader` connection point; the acceptance smoke uses a fixture loader.
No production database or application route integration is claimed.

## Pull request requirements
- Branch: `feat/fp-18-bounded-agent-runtime-integrity-and-cash-agents`.
- Reference this issue and include the acceptance-check evidence.
- Request review before merging to `main`.
- Coordinate API/schema changes and preserve user authorization, source labels, and server-only secrets.

## References
[API contract](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/API.md) · [Security requirements](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/SECURITY.md) · [Agent design](https://github.com/ssgadige/FinPilot-HackUTD/blob/main/docs/AGENTS.md)

[Issue #18](https://github.com/ssgadige/FinPilot-HackUTD/issues/18)
