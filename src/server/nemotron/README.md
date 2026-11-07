# Nemotron adapter — FP-17 / issue #17

Node-only TypeScript, using native fetch. No SDK or extra service. Requires Node
22.18+ (native TypeScript stripping) or the application's TypeScript build.
Never import into client code. Role-specific tool execution and authenticated
context injection belong to FP-18; the adapter does not execute model requests.

## Configuration and protocol

Set `NVIDIA_API_KEY` and `NEMOTRON_MODEL` in the ignored root `.env` file.
`NEMOTRON_BASE_URL` defaults to `https://integrate.api.nvidia.com/v1`;
custom HTTPS endpoints must be operator-controlled, never supplied by a user.
`NEMOTRON_TIMEOUT_MS` defaults to 30000 and cannot exceed 30000.

Candidate documented model: `nvidia/nemotron-3.5-super-vl-120b-a12b`.
Account access was verified by the live smoke below. No fallback model is used.

Uses NVIDIA's documented OpenAI-compatible `/chat/completions` protocol:
`tools`, `tool_choice`, assistant `tool_calls`, and tool messages with matching
`tool_call_id`. No prompt-parsed XML or invented tool syntax. Non-streaming,
temperature 0, max_tokens 1024. Reasoning content is discarded. Model-specific
reasoning overrides are deliberately omitted; provider defaults apply.
Reference: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-super-vl-120b-a12b-infer

## Verification

From the repository root:

```sh
node --test tests/nemotron.test.ts
node --env-file-if-exists=.env scripts/smoke-nemotron.ts
```

The CLI always uses the real provider, with no fixture or replay path. Its only
allowed tool is a local diagnostic probe with a fixed `probe: "fp17"` argument; no
identity, finance data, database, URL, or shell access is exposed. After validating
the model request, the tool generates a fresh random token. The second model
request receives that value in a tool message and must return it exactly. This
checks consumption of the result, rather than merely the appearance of a tool
call. The probe is diagnostic data, not a financial fixture or a live bank source.

Success emits a secret-free JSON record with model, endpoint, settings, timestamp,
per-request and total latency, and result-consumption status. Save actual CLI
output as PR evidence only after it succeeds against the real provider. Never
use unit-test mock output as live evidence. Failure exits nonzero with a safe
error code. No raw prompts, tokens, provider bodies, or credentials are logged.

Errors: `NEMOTRON_UNAVAILABLE` / `NEMOTRON_CONFIG` (503), and provider failure,
invalid response, timeout or cancellation (502). Smoke-specific errors identify
disallowed tools, invalid arguments, or a result the model did not consume.
Requests have a 30-second default timeout, redirects disabled, and a 1 MiB response
limit. The smoke has a 90-second total deadline and exactly two inference calls.
No automatic retries. Applications must enforce their own aggregate run budget
and pass cancellation signals.

## Acceptance evidence

- Unit tests cover transport protocol, secret-safe errors, timeout/cancellation,
  malformed/truncated/oversized output, mocked tool round trip, unknown tools,
  identity injection, and invented results.
- Real CLI passed on 2026-11-07 at 23:55:07 UTC: one allowed tool call and
  exact consumption of its fresh result. Seven unit tests passed.
- The probe uses a required fixed argument because the provider supplied an
  unexpected argument for an empty-object schema. Argument validation remains
  strict; no extra keys or model-selected identity are accepted.

```json
{"status":"passed","inference_source_mode":"live","model":"nvidia/nemotron-3.5-super-vl-120b-a12b","endpoint":"https://integrate.api.nvidia.com/v1","protocol":"openai-chat-tools","timeout_ms":30000,"max_tokens":1024,"temperature":0,"tool":"read_smoke_probe","tool_calls":1,"result_consumed":true,"request_latency_ms":[788,1255],"total_latency_ms":2044,"checked_at":"2026-11-07T23:55:07.288Z"}
```

- Branch: `feat/fp-17-nemotron-adapter-and-actual-tool-call-smoke-test`.
  Reference #17 and attach real CLI evidence when opening a PR; request review
  before merging. No API/schema changes.
