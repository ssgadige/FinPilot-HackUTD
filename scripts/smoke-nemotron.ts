import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { complete, readConfig, NemotronError } from '../src/server/nemotron/index.ts';
import type { Config, Message, Tool } from '../src/server/nemotron/index.ts';

export async function smoke(config: Config, transport: typeof fetch = fetch) {
  const started = Date.now();
  const tools: Tool[] = [{ type: 'function', function: {
    name: 'read_smoke_probe', description: 'Read a fresh server-generated diagnostic token. No financial data.',
    parameters: { type: 'object', properties: { probe: { type: 'string', enum: ['fp17'] } }, required: ['probe'], additionalProperties: false },
  } }];
  const messages: Message[] = [
    { role: 'system', content: 'Call read_smoke_probe exactly once with {"probe":"fp17"}. Then return only the token from its result, without quotes or formatting.' },
    { role: 'user', content: 'Run the diagnostic tool and report its returned token.' },
  ];
  const deadline = AbortSignal.timeout(90000);
  const first = await complete(config, messages, tools, 'required', deadline, transport);
  const calls = first.message.tool_calls;
  if (calls?.length !== 1 || calls[0].function.name !== 'read_smoke_probe')
    throw new NemotronError('SMOKE_TOOL_NOT_ALLOWED', 502);
  let args;
  try { args = JSON.parse(calls[0].function.arguments); }
  catch { throw new NemotronError('SMOKE_INVALID_ARGUMENTS', 502); }
  if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).length !== 1 || args.probe !== 'fp17')
    throw new NemotronError('SMOKE_INVALID_ARGUMENTS', 502);
  // Generated only after the model requests the tool, proving result consumption.
  const token = randomBytes(24).toString('hex');
  messages.push(first.message, { role: 'tool', tool_call_id: calls[0].id,
    content: JSON.stringify({ token, kind: 'diagnostic', financial_data: false }) });
  const second = await complete(config, messages, tools, 'none', deadline, transport);
  if (second.message.tool_calls?.length || second.message.content?.trim() !== token)
    throw new NemotronError('SMOKE_RESULT_NOT_CONSUMED', 502);
  return { status: 'passed', inference_source_mode: 'live',
    model: config.model, endpoint: config.baseUrl, protocol: 'openai-chat-tools',
    timeout_ms: config.timeoutMs, max_tokens: 1024, temperature: 0,
    tool: 'read_smoke_probe', tool_calls: 1, result_consumed: true,
    request_latency_ms: [first.latencyMs, second.latencyMs],
    total_latency_ms: Date.now() - started, checked_at: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const started = Date.now();
  try {
    console.log(JSON.stringify(await smoke(readConfig())));
  } catch (error) {
    console.error(JSON.stringify({ status: 'failed', code: error instanceof NemotronError ? error.code : 'SMOKE_FAILED',
      total_latency_ms: Date.now() - started }));
    process.exitCode = 1;
  }
}
