# FP-18 — bounded integrity and cash agents

Implements issue #18 on branch
`feat/fp-18-bounded-agent-runtime-integrity-and-cash-agents`.
No API or shared contract changes. Request review before merging to main.

## Run and verify

Use Node 22.18+ for native TypeScript execution. No third-party runtime packages.
From the repository root:

```sh
node --test tests/agent-runtime.test.ts tests/nemotron.test.ts
node --env-file-if-exists=.env scripts/smoke-agents.ts --record
```

The smoke uses real Nemotron inference and a **fixture financial snapshot**.
It never falls back to mocked inference. `--record` writes `acceptance.json` here
only after both agents and all smoke assertions pass. The artifact contains the
actual tool trace, safe activity events, model, timing, results and fixture evidence.
It contains no credentials, raw prompts or hidden reasoning. Failed runs exit
nonzero with safe error codes and leave any previous acceptance artifact intact.

The synthetic scenario has paired savings and credit-card transfers, an unmatched
transfer leg, duplicate transaction IDs, two ledger mismatches and stale savings.
Checking holds 50000 cents; the 120000-cent rent on 2026-11-10 takes it to -70000
before income on 2026-11-15. Positive combined cash does not resolve this account
shortfall. The smoke asserts both integrity findings and the dated cash collision.

## Server integration

`runIntegrity` and `runCash` load their existing distinct Markdown role prompts.
Both use the same `runAgent` loop and default to the real FP-17 adapter.
`runCash` requires a completed integrity dependency for the same authenticated
user, run, snapshot and selected accounts. The dependency is supplied as explicitly
untrusted data, never as privileged instructions.

`createTools(loadSnapshot)` exposes these read-only tools:

| Role | Allowed tools |
| --- | --- |
| data-integrity | get_connection_status, reconcile_ledger, find_transfer_pairs |
| cash-collision | get_cash_calendar, forecast_cash, compare_cash_scenarios |

Each tool accepts only `{ "scope": "snapshot" }`. Model-supplied identity,
account selection, arbitrary SQL, URLs and execution instructions are rejected.
The backend supplies `ToolContext` after completed authentication, then the runtime
clones and recursively freezes it. Every tool invocation loads a fresh authorized
snapshot and verifies user, snapshot version, selected accounts, active consent,
transaction ownership and scheduled-item ownership before calculation.

The authenticated data layer and FP-13 calculations are now present upstream.
`SnapshotLoader` remains the server connection point. The new
[BackendAgentBridge](../integration/backend.ts) projects consent-scoped, selected
application records into integrity/cash and subscription snapshots. It rechecks
snapshot ownership and disconnects on every read. Application agent HTTP routes now call these services after verified authentication; see [run integration](../../runs/README.md).

Supply one shared `RunBudget` for all agents in a checkup, the same cancellation
signal, and a trusted server tool registry. Third concurrent specialists fail with
`CONCURRENCY_LIMIT`; the coordinator must schedule at most two at once. Persist
returned results/evidence/trace with the authenticated owner and snapshot. Use
`onEvent` for synchronous event persistence; storage/routes remain owned by the
run orchestration task. No caller-supplied tool registry or inference function
should be exposed through an API.

## Validation and limits

- Maximum 4 tool rounds, 3 calls per batch, 24 model calls per shared run budget,
  2 concurrent specialists, 90 seconds per specialist, and provider timeout capped
  at 30 seconds by FP-17 configuration. Each completion has at most 4096 tokens;
  the smaller FP-17 probe retains its default 1024-token limit.
- Role tools are offered once each, with full-batch validation before execution.
  Unknown, repeated, off-role and duplicate calls fail without unauthorized execution.
- Tool and provider promises are bounded even if they ignore cancellation. Tool
  implementations must also honor the supplied signal. No new calls start after
  cancellation. Tools are read-only and never transfer funds or change preferences.
- Tool output is bounded to 64000 characters per call; FP-17 caps provider responses
  at 1 MiB. Projected data excludes merchant text. Tool-returned data and dependency
  prose remain untrusted, even when they look like instructions.
- The frozen AgentResult schema is validated with a small validator covering its
  used schema keywords. Role and snapshot are constrained. Findings must cite known
  tool evidence included in top-level evidence_ids. Each non-null finding amount
  must match an explicit cents value in its cited tool output. Qualitative findings
  use null. Full semantic/prose evidence checking remains FP-23's responsibility.
- Malformed final output gets exactly one repair with a safe validation reason,
  then a visible failed result. No extra tools are permitted during repair. Provider,
  authorization, budget and cancellation failures stop immediately.
- Logs/events contain fixed status text, tool names and safe failure codes, never
  raw model output, secret arguments or hidden reasoning. Source provenance lives
  on evidence and traces; real inference never relabels fixture finances as live.

## Deterministic calculation assumptions

Opening balances plus historical deltas are reconciled against snapshot balances.
Duplicate transaction IDs and mismatches are flagged rather than silently removed.
Transfers are paired within three days across distinct accounts; liability deltas
are sign-normalized so card payments match their checking counterparts. Unmatched
legs are flagged and never called new income or spending.

The cash calendar covers the 30 days strictly after the snapshot date. Snapshot
balances already include historical transactions; those transactions are never
reapplied. Only checking, savings and wallet balances are spendable. Duplicate
scheduled IDs fail. Integer-cent operations reject precision overflow. Same-day
expenses precede income conservatively. Scenarios compare baseline with income
delayed seven days; both use the same 30-day horizon. Stale balances require review
and cannot be assumed available for a proposed transfer. All actions remain
suggestions requiring confirmation.

## FP-19 extension

The same runtime also supports `subscription-detective` and `deal-scout` using
`createSubscriptionTools` from `../subscription-tools.ts`. Deal Scout requires
a scoped Subscription Detective dependency. Tool-declared missing information is
enforced in final result status and missing_data. The two new roles also validate
dollar prose against integer-cent evidence and receive deterministic currency
displays. Their source adapter, fixture/live configuration and current acceptance
trace are documented in [the offers README](../../offers/README.md).

## FP-20 extension

`debt-readiness` and `goal-allocator` use `createPlanningTools` from
`../planning/tools.ts`. Goal Allocator requires a scoped Debt Readiness dependency
and produces fresh alternatives from its own tools. Missing APR/minimum/card limit
forces needs_information; numerical score and affirmative approval claims are
rejected. Existing currency, ownership and budget checks are preserved. See
[planning assumptions and acceptance evidence](../planning/README.md).

## FP-21 extension

`stress-test` uses the role-specific `createStressTools` registry in
`../stress/tools.ts`, with a same-context Goal Allocator dependency. Its similarly
named forecast/comparison tools are not interchangeable with other roles' tools.
It reports independent fixed shocks, dated constraint failures and goal funding
changes within an explicit horizon; probability and resilience-guarantee claims
are rejected. See [stress assumptions and live evidence](../stress/README.md).

## FP-22–24 extensions

Repair, coordinator and chat share the same bounded runtime and explicit role tool
allowlists. Optional evidence/output hooks support owner and numerical validation;
`offeredTools` can only narrow a role's allowlist. `serverToolOutputs` retains
private tool material for validated follow-up chat; do not expose it wholesale.
See [coordinator/evidence/chat](../coordinator/README.md) and
[repair](../repair/README.md).

For the explicitly supported Nemotron 3.5 model, runtime calls request
`reasoning_effort: none` to keep seeded ledger inference within the response
budget. Other models receive no unsupported override. Transfer tools retain all
unmatched groups and aggregate counts; large histories show only five matched
examples with an explicit omitted count. This bounds context without hiding
unmatched transfer anomalies.
