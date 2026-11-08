import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readConfig,complete } from '../src/server/nemotron/index.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { runDebt } from '../src/server/agents/debt.ts';
import { runGoals } from '../src/server/agents/goals.ts';
import { runStress } from '../src/server/agents/stress.ts';
import { createPlanningTools } from '../src/server/agents/planning/tools.ts';
import { createStressTools } from '../src/server/agents/stress/tools.ts';
import { fixture,context } from './fixtures/fp21.ts';
let stage='configuration';const failures:string[]=[];
try {
  const config=readConfig();const budget=new RunBudget();const started=Date.now();const latencies:number[]=[];
  const planningTools=createPlanningTools(async()=>fixture().planning);const stressTools=createStressTools(async()=>fixture());
  const infer:typeof complete=async(...args)=>{const r=await complete(...args);latencies.push(r.latencyMs);return r;};
  const onEvent=(e:{type:string;message:string})=>{if(e.type==='failed')failures.push(e.message);};
  stage='debt-readiness';const debt=await runDebt({context,config,tools:planningTools,budget,infer,onEvent});assert.equal(debt.result.status,'completed');
  stage='goal-allocator';const goals=await runGoals({context,config,tools:planningTools,budget,infer,onEvent,dependency:{context,result:debt.result,evidence:debt.evidence}});assert.equal(goals.result.status,'completed');
  stage='stress-test';const stress=await runStress({context,config,tools:stressTools,budget,infer,onEvent,dependency:{context,result:goals.result,evidence:goals.evidence}});
  assert.equal(stress.result.status,'completed');assert.equal(stress.trace.length,3);
  stage='stress-findings';const text=JSON.stringify(stress.result);
  for(const id of ['delayed_income','surprise_expense','reduced_income'])assert.ok(text.includes(id));
  assert.ok(stress.result.findings.some(f=>f.id==='goal_changes'));
  assert.ok(text.includes('2026-11-20'));assert.ok(text.includes('2026-11-14'));
  const comparison=(await stressTools.compare_plans.execute({scope:'snapshot'},context,new AbortController().signal)).data as any;
  assert.equal(comparison.baseline_preserved,true);assert.equal(comparison.scenario_summaries[1].worst_minimum_cash_cents,-50000);
  assert.ok(stress.evidence.every(e=>e.source_mode==='fixture'));
  const report={status:'passed',checked_at:new Date().toISOString(),model:config.model,inference_source_mode:'live',financial_source_mode:'fixture',
    total_latency_ms:Date.now()-started,model_calls:budget.calls,request_latency_ms:latencies,debt,goals,stress,comparison,
    dependency:'Debt Readiness → Goal Allocator → Stress-Test, with the same authenticated context and shared call budget'};
  const json=JSON.stringify(report,null,2);
  if(process.argv.includes('--record'))writeFileSync(new URL('../src/server/agents/stress/acceptance.json',import.meta.url),json+'\n');
  console.log(json);
} catch {
  console.error(JSON.stringify({status:'failed',stage,failures,code:'FP21_SMOKE_FAILED'}));process.exitCode=1;
}
