# Event-driven plan repair (FP-22)

`repairChangedEvent` consumes an explicitly authorized demo `surprise_expense` event. The server supplies the user, selected accounts, current snapshot, provider configuration, shared budget and authorization callback. It must derive identity from a verified session and recheck consent on every read. Models cannot choose identity or accept a plan.

`RepairStore` uses private SQLite storage and parameterized owner keys. A transaction records the event fingerprint and applies its expense once. A repeated idempotency key returns the persisted processing/completed/failed outcome; changing its payload rejects it. Snapshot/version checks reject stale completion. Restarting the process does not repeat the expense or inference.

The event advances the snapshot, then reruns Debt Readiness, Goal Allocator and Plan Repair with fresh deterministic tools. The proposed revision contains before/after allocations, constraints, evidence and a diff. The accepted baseline remains unchanged even when a provider fails. A revision always requires confirmation; this service has no automatic acceptance operation.

This is an event-service integration seam, separate from the application's FP-14 plan store. FP-15 now dispatches authenticated application events through a conservative monthly repair adapter; see [run integration](../../runs/README.md). It reports missing metadata instead of converting the one-period fixture allocations into monthly promises. Only surprise expenses are supported here; unsupported event kinds reject.

## Verification

`npm run test:agents` covers durable replay across restarts, concurrent duplicates, conflicting event keys, ownership/consent, stale versions, provider failure, exact diff amounts and retained acceptance. Inference is mocked in local tests; calculations and SQLite are real.

[Retained live repair evidence](acceptance.json) records real inference over fixture finances from an earlier smoke. It is historical evidence, not a fresh run of the current integration. Repeating an event is explicitly cached with zero new model calls.
