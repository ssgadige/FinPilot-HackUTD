import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complete, readConfig } from '../src/server/nemotron/index.ts';
import { smoke } from '../scripts/smoke-nemotron.ts';

const config = readConfig({ NVIDIA_API_KEY: 'test-secret', NEMOTRON_MODEL: 'nvidia/nemotron-3.5-super-vl-120b-a12b' });
const messages = [{ role: 'user' as const, content: 'test' }];
const response = (message: unknown, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ message, finish_reason }] }));

test('missing credentials and invalid config fail explicitly', () => {
  assert.throws(() => readConfig({}), { code: 'NEMOTRON_UNAVAILABLE', status: 503 });
  for (const override of [{ NEMOTRON_TIMEOUT_MS: '0' }, { NEMOTRON_BASE_URL: 'http://example.com' },
    { NEMOTRON_MODEL: 'another-model' }, { NEMOTRON_BASE_URL: 'https://example.com/?secret=x' }]) {
    assert.throws(() => readConfig({ NVIDIA_API_KEY: 'test', NEMOTRON_MODEL: config.model, ...override }),
      { code: 'NEMOTRON_CONFIG' });
  }
});
test('sends documented tool protocol and preserves call IDs while discarding reasoning', async () => {
  const call = { id: 'call-1', type: 'function', function: { name: 'probe', arguments: '{}' } };
  const tools = [{ type: 'function' as const, function: { name: 'probe', description: 'probe', parameters: { type: 'object' } } }];
  const transport: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.equal(options?.redirect, 'error');
    const body = JSON.parse(options?.body as string);
    assert.equal(body.stream, false); assert.equal(body.tool_choice, 'required');
    assert.deepEqual(body.tools, tools);
    return response({ role: 'assistant', content: null, tool_calls: [call], reasoning_content: 'private' }, 'tool_calls');
  };
  const result = await complete(config, messages, tools, 'required', undefined, transport);
  assert.deepEqual(result.message, { role: 'assistant', content: null, tool_calls: [call] });
});
test('provider failures never expose bodies or native errors', async () => {
  for (const transport of [async () => new Response('test-secret', { status: 401 }),
    async () => { throw new Error('test-secret'); }, async () => new Response('invalid-json')]) {
    await assert.rejects(complete(config, messages, [], 'auto', undefined, transport),
      { message: 'NEMOTRON_PROVIDER_ERROR', status: 502 });
  }
});
test('malformed, truncated and oversized responses fail', async () => {
  for (const transport of [async () => response({ role: 'assistant', content: 'partial' }, 'length'),
    async () => response({ role: 'assistant', content: null, tool_calls: [{ id: 'x' }] }, 'tool_calls'),
    async () => new Response('x'.repeat(1_048_577))]) {
    await assert.rejects(complete(config, messages, [], 'auto', undefined, transport), { code: 'NEMOTRON_INVALID_RESPONSE' });
  }
});
test('timeout and cancellation are explicit', async () => {
  const transport: typeof fetch = async (_url, options) => new Promise((_resolve, reject) => {
    const signal = options?.signal;
    if (signal?.aborted) { reject(signal.reason); return; }
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    // Keep the event loop alive for AbortSignal.timeout's unreferenced timer.
    const timer = setTimeout(() => reject(new Error('test deadline')), 100);
    signal?.addEventListener('abort', () => clearTimeout(timer), { once: true });
  });
  await assert.rejects(complete({ ...config, timeoutMs: 5 }, messages, [], 'auto', undefined, transport),
    { code: 'NEMOTRON_TIMEOUT' });
  await assert.rejects(complete(config, messages, [], 'auto', AbortSignal.abort(), transport),
    { code: 'NEMOTRON_CANCELLED' });
});

test('mocked smoke returns the requested tool value to the model with matching ID', async () => {
  let calls = 0;
  const transport: typeof fetch = async (_url, options) => {
    const body = JSON.parse(options?.body as string);
    calls++;
    if (calls === 1) return response({ role: 'assistant', content: null, tool_calls: [
      { id: 'probe-1', type: 'function', function: { name: 'read_smoke_probe', arguments: '{"probe":"fp17"}' } },
    ] }, 'tool_calls');
    assert.equal(body.tool_choice, 'none');
    const toolResult = body.messages.at(-1);
    assert.equal(toolResult.role, 'tool'); assert.equal(toolResult.tool_call_id, 'probe-1');
    const { token } = JSON.parse(toolResult.content);
    assert.match(token, /^[a-f0-9]{48}$/);
    return response({ role: 'assistant', content: token });
  };
  const report = await smoke(config, transport);
  assert.equal(report.result_consumed, true); assert.equal(calls, 2);
  // Mock reports are unit assertions only; never save them as live acceptance evidence.
});
test('smoke rejects disallowed tools, identity injection, and unconsumed results', async () => {
  for (const [name, args, code] of [
    ['execute_sql', '{}', 'SMOKE_TOOL_NOT_ALLOWED'],
    ['read_smoke_probe', '{"user_id":"other-user"}', 'SMOKE_INVALID_ARGUMENTS'],
    ['read_smoke_probe', 'null', 'SMOKE_INVALID_ARGUMENTS'],
    ['read_smoke_probe', '{', 'SMOKE_INVALID_ARGUMENTS'],
    ['read_smoke_probe', '{"probe":"fp17"}', 'SMOKE_RESULT_NOT_CONSUMED'],
  ]) {
    let calls = 0;
    const transport: typeof fetch = async () => ++calls === 1
      ? response({ role: 'assistant', content: null, tool_calls: [
        { id: 'probe', type: 'function', function: { name, arguments: args } },
      ] }, 'tool_calls') : response({ role: 'assistant', content: 'invented result' });
    await assert.rejects(smoke(config, transport), { code });
    assert.equal(calls, code === 'SMOKE_RESULT_NOT_CONSUMED' ? 2 : 1);
  }
});

test('agent token override is bounded and default probe settings are preserved', async () => {
  for (const maxTokens of [4096, undefined]) {
    const transport: typeof fetch = async (_url, options) => {
      assert.equal(JSON.parse(options?.body as string).max_tokens, maxTokens ?? 1024);
      return response({ role: 'assistant', content: 'ok' });
    };
    await complete({ ...config, maxTokens }, messages, [], 'auto', undefined, transport);
  }
  await assert.rejects(complete({ ...config, maxTokens: 4097 }, messages), { code: 'NEMOTRON_CONFIG' });
});
