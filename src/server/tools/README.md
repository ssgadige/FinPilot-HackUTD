# Server tool implementation boundary

FP-13 creates deterministic calculations. FP-18 exposes validated role-specific schemas. Tools receive authenticated server context, never model-selected user identity. See docs/AGENTS.md and docs/SECURITY.md.

FP-18 implements the two initial agents' deterministic snapshot tools in
`src/server/agents/runtime/tools.ts`, with an authorized SnapshotLoader boundary.
See that runtime's README for integration and live acceptance evidence. The
broader FP-13 finance library and production backend loader are still separate
implementation work.
