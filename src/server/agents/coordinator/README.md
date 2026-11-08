# Coordinator, evidence gate and chat (FP-23)

`runCheckup` runs Nemotron with a fixed specialist enum and a server-owned dependency graph. The model can select only roles permitted by the requested intent; it cannot supply tools, identities or accounts. Dependency handoffs and irrelevant, unavailable, failed or budget-skipped roles appear in `steps`. Plan Repair is dispatched separately through its changed-event service.

One shared `RunBudget` allows 24 model calls and two active roles. The coordinator reserves capacity for its completion and conservatively admits specialists; a full checkup may explicitly skip later roles. No hidden follow-up run bypasses this limit. Per-role alternatives remain separate rather than summed. Conflicting trusted canonical monetary claims force review.

`EvidenceGate` binds evidence to user/run/snapshot/selected accounts, rejects source identity changes and unknown references, and checks numerical amounts, dollar prose and dates against deterministic tool output. This checks ownership and explicit facts; it does not prove arbitrary semantic entailment. Source modes remain distinct from inference modes.

`chat` loads server-owned findings, their original contexts and tool outputs. It validates them before exposing evidence to a fresh chat run. Its normal tools read overview, findings and plan. `request_checkup` is offered only after explicit server authorization and uses a stable idempotency key; the callback must enforce that key. No model tool accepts plans, purchases products or executes transactions. Credential-shaped input is rejected before inference.

`serverToolOutputs` is private persistence material for grounding later chat, not a browser/analytics payload. Persist it with the owner and snapshot; expose only appropriate sanitized evidence/activity through API projections.

## Verification

`npm run test:agents` checks routing, handoffs, budget exhaustion, ownership, unknown evidence, conflicting amounts, dates, unavailable capabilities, read-only chat and unauthorized run requests. Tests use mocked inference and real deterministic tools. Fresh live coordinator/chat verification is pending: the user requested local tests only.

The [backend bridge](../integration/backend.ts) reads actual consent-scoped application records for integrity, cash and subscriptions/deals. It intentionally reports planning/stress unavailable until goal funding accounts and debt payment account/date mappings exist. Its identity argument must come from the verified application session. FP-15 now connects these services to authenticated run/chat routes; see [run integration](../../runs/README.md). The FP-07 agent workspace remains pending.
