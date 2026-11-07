# Nemotron agent system

**Eight specialists + one coordinator; chatbot is a separate interface role.** Each specialist has a distinct objective, allowlist, structured output and real model/tool round trip. A renamed deterministic report does not count as an autonomous agent. One configurable Nemotron endpoint can serve every role.

| Agent | Unique contribution | Depends on |
|---|---|---|
| Data Integrity | Prevents misleading totals caused by transfers, duplicate imports and stale data | Connections and ledger |
| Cash Collision | Finds timing conflicts that combined balances hide | Integrity |
| Subscription Detective | Recurrence, price creep and overlaps requiring user confirmation | Merchant ledger |
| Deal Scout | Compares terms and true costs, not just headline monthly prices | Confirmed subscription/preferences |
| Debt and Purchase Readiness | Compares payoff allocations while preserving bill cash | Integrity + cash capacity |
| Goal Negotiator | Coordinates competing goals without spending one dollar twice | Cash + debt + accepted subscription changes |
| Stress-Test | Challenges plans with explicit adverse scenarios | Candidate plans |
| Plan Repair | Revises stale plans after new data while preserving user control | Changed-data event + prior plan |
| Coordinator | Chooses specialists, orders dependencies and merges supported findings | User intent + capability registry |

Evidence checking is a deterministic gate, not an extra agent badge. Banking/credit actions remain proposals.

## Distinctive demo

Detect overlapping services and an annual renewal → verify an alternative offer → show optional savings → user accepts a plan change → allocate freed cash between car savings and debt → stress-test → inject expense → generate a revised proposal. Every step has a persistent evidence record.

## Runtime contract

See contracts/types.ts and contracts/agent-result.schema.json. Server constructs immutable user/snapshot context. Agent may select tools only from its role allowlist. Validate every call, execute authorized code, return tool result to the model, validate final structured result and persist evidence. Retry malformed structured output once; then fail visibly. Shared runtime does not mean shared conversation history across users.

The coordinator returns specialist IDs from an enum; server controls the DAG. Limit concurrency to 2 initially. Maximum 4 tool rounds per specialist, 24 model calls per checkup, bounded tokens/time and cancellation. Store concise activity events, not hidden chain-of-thought. Mark skipped roles, failed dependencies, fixture offers, cached runs and stale snapshots clearly. Run IDs and idempotency keys prevent duplicate work.

## Financial tools

Tools compute integer cents, Decimal/APR calculations and explicit date assumptions. Forecast starts from current reconciled balances, applies future scheduled income/bills once, and excludes retirement/investment assets from spendable cash. Debt simulator includes minimum payments, APR, payment date and monthly/annual rate conventions. Never use LLM arithmetic as the source of truth.

Read-only analysis is automatic. Saving/accepting a plan, changing a goal or confirming a subscription change requires a typed server-side action and user confirmation. Chat may request a run but cannot invent authorization. Tools never perform real money movement.

## Integration acceptance

Record selected accessible Nemotron model ID and a real tool-call smoke test. All nine agent roles and chat use Nemotron; no unrelated model fallback. Checkup trace must prove at least one dependency where a later specialist consumes an earlier result. Providers absent → explicit unavailable state. Replay mode, if provided for a demo backup, is visibly marked and never represented as live inference.
