// Node-only: never import this module into a client component.
import { performance } from 'node:perf_hooks';

export class NemotronError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code); this.name = 'NemotronError'; this.code = code; this.status = status;
  }
}
export interface ToolCall {
  id: string; type: 'function'; function: { name: string; arguments: string };
}
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface Tool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}
export interface Config {
  apiKey: string; baseUrl: string; model: string; timeoutMs: number;
  maxTokens?: number;
  reasoningEffort?: 'none' | 'low' | 'high';
}
export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  if (!env.NVIDIA_API_KEY?.trim() || !env.NEMOTRON_MODEL?.trim())
    throw new NemotronError('NEMOTRON_UNAVAILABLE', 503);
  const model = env.NEMOTRON_MODEL.trim();
  const baseUrl = env.NEMOTRON_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new NemotronError('NEMOTRON_CONFIG', 503); }
  const timeoutMs = Number(env.NEMOTRON_TIMEOUT_MS || 30000);
  if (!model.toLowerCase().includes('nemotron') || url.protocol !== 'https:' ||
      url.username || url.password || url.search || url.hash ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000)
    throw new NemotronError('NEMOTRON_CONFIG', 503);
  return { apiKey: env.NVIDIA_API_KEY.trim(), baseUrl: baseUrl.replace(/\/$/, ''), model, timeoutMs };
}

// Returns only public assistant content and structured tool calls, never reasoning.
// Callers own role allowlists, argument validation, authorization and total run budgets.
export async function complete(config: Config, messages: Message[], tools: Tool[] = [],
  toolChoice: 'auto' | 'required' | 'none' = 'auto', signal?: AbortSignal,
  transport: typeof fetch = fetch) {
  const start = performance.now();
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;
  try {
    const maxTokens = config.maxTokens ?? 1024;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096)
      throw new NemotronError('NEMOTRON_CONFIG', 503);
    if (config.reasoningEffort !== undefined &&
      (config.model !== 'nvidia/nemotron-3.5-super-vl-120b-a12b' || !['none', 'low', 'high'].includes(config.reasoningEffort)))
      throw new NemotronError('NEMOTRON_CONFIG', 503);
    const response = await transport(`${config.baseUrl}/chat/completions`, {
      method: 'POST', redirect: 'error', signal: combined,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, stream: false,
        max_tokens: maxTokens, temperature: 0,
        ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}),
        ...(tools.length ? { tools, tool_choice: toolChoice, parallel_tool_calls: false } : {}) }),
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new NemotronError('NEMOTRON_PROVIDER_ERROR', 502);
    }
    // Bound provider output, including any reasoning, before JSON parsing.
    const reader = response.body?.getReader();
    if (!reader) throw new NemotronError('NEMOTRON_INVALID_RESPONSE', 502);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) { await reader.cancel(); throw new NemotronError('NEMOTRON_INVALID_RESPONSE', 502); }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const choice = data?.choices?.[0]; const message = choice?.message;
    if (!message || message.role !== 'assistant' ||
        !['stop', 'tool_calls'].includes(choice.finish_reason) ||
        (message.content !== null && typeof message.content !== 'string'))
      throw new NemotronError('NEMOTRON_INVALID_RESPONSE', 502);
    const calls = message.tool_calls;
    if (calls !== undefined && (!Array.isArray(calls) || calls.length > 8 || calls.some((c: ToolCall) =>
      !c || typeof c.id !== 'string' || !c.id || c.type !== 'function' ||
      typeof c.function?.name !== 'string' || typeof c.function?.arguments !== 'string')))
      throw new NemotronError('NEMOTRON_INVALID_RESPONSE', 502);
    if (choice.finish_reason === 'tool_calls' && !calls?.length)
      throw new NemotronError('NEMOTRON_INVALID_RESPONSE', 502);
    return { message: { role: 'assistant', content: message.content,
      ...(calls?.length ? { tool_calls: calls.map((c: ToolCall) => ({ id: c.id,
        type: 'function', function: { name: c.function.name, arguments: c.function.arguments } })) } : {}) } as Message,
      latencyMs: Math.round(performance.now() - start) };
  } catch (error) {
    if (signal?.aborted) throw new NemotronError('NEMOTRON_CANCELLED', 502);
    if (timeout.aborted) throw new NemotronError('NEMOTRON_TIMEOUT', 502);
    if (error instanceof NemotronError) throw error;
    // Provider bodies, request headers and native error messages may contain secrets.
    throw new NemotronError('NEMOTRON_PROVIDER_ERROR', 502);
  }
}
