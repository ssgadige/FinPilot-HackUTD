import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { complete, readConfig } from '../src/server/nemotron/index.ts';
import { runIntegrity } from '../src/server/agents/integrity.ts';
import { runCash } from '../src/server/agents/cash.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { createTools } from '../src/server/agents/runtime/tools.ts';
import { context, fixture } from './fixtures/fp18.ts';

let stage = 'configuration';
const failures: string[] = [];
try {
  const config = readConfig(); const budget = new RunBudget();
  const tools = createTools(async () => fixture());
  const latencies: number[] = [];
  const infer: typeof complete = async (...args) => {
    const result = await complete(...args); latencies.push(result.latencyMs); return result;
  };
  const started = Date.now();
  stage = 'integrity';
  const onEvent = (event: { type: string; message: string }) => { if (event.type === 'failed') failures.push(event.message); };
  const integrity = await runIntegrity({ context, config, tools, budget, infer, onEvent });
  assert.equal(integrity.result.status, 'completed');
  stage = 'integrity-findings';
  const text = JSON.stringify(integrity.result);
  assert.match(text, /duplicate/i); assert.match(text, /transfer/i); assert.match(text, /stale/i);
  stage = 'cash';
  const cash = await runCash({ context, config, tools, budget, infer, onEvent,
    dependency: { result: integrity.result, evidence: integrity.evidence, context } });
  assert.equal(cash.result.status, 'completed');
  stage = 'cash-findings';
  assert.ok(cash.result.findings.some(f => f.summary.includes('2026-11-10') && f.amount_cents === -70000));
  assert.ok([...integrity.evidence, ...cash.evidence].every(e => e.source_mode === 'fixture'));
  const report = { status: 'passed', inference_source_mode: 'live', financial_source_mode: 'fixture',
    model: config.model, checked_at: new Date().toISOString(), total_latency_ms: Date.now() - started,
    request_latency_ms: latencies, model_calls: budget.calls,
    settings: { max_tokens: 4096, specialist_timeout_ms: 90000, max_tool_rounds: 4, max_run_model_calls: 24 },
    integrity: { result: integrity.result, evidence: integrity.evidence, trace: integrity.trace, events: integrity.events },
    cash: { result: cash.result, evidence: cash.evidence, trace: cash.trace, events: cash.events },
    dependency: 'cash consumes integrity result for the same user, run, snapshot and accounts' };
  const serialized = JSON.stringify(report, null, 2);
  if (process.argv.includes('--record')) writeFileSync(new URL('../src/server/agents/runtime/acceptance.json', import.meta.url), `${serialized}\n`);
  console.log(serialized);
} catch {
  // Never print native assertions, provider payloads or secret configuration.
  console.error(JSON.stringify({ status: 'failed', code: 'FP18_SMOKE_FAILED', stage, failures }));
  process.exitCode = 1;
}
