import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readConfig,complete } from '../src/server/nemotron/index.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { runDebt } from '../src/server/agents/debt.ts';
import { runGoals } from '../src/server/agents/goals.ts';
import { createPlanningTools } from '../src/server/agents/planning/tools.ts';
import { fixture,context } from './fixtures/fp20.ts';
let stage='configuration';const failures:string[]=[];
const observed:{role:string;amounts:(number|null)[];dollar_claims:string[]}[]=[];
try {
  const config=readConfig();const started=Date.now();const budget=new RunBudget();const tools=createPlanningTools(async()=>fixture());
  const latencies:number[]=[];
  const infer:typeof complete=async(...args)=>{
    const r=await complete(...args);latencies.push(r.latencyMs);
    if(!r.message.tool_calls?.length)try {
      const output=JSON.parse(r.message.content??'');
      if(Array.isArray(output.findings))observed.push({role:output.agent_id==='goal-allocator'?'goal-allocator':'debt-readiness',
        amounts:output.findings.map((f:any)=>typeof f.amount_cents==='number'?f.amount_cents:null),
        dollar_claims:[...new Set((r.message.content??'').match(/\$\d[\d,]*(?:\.\d+)?/g)??[])]});
    } catch { /* Never expose provider text or credentials in failure diagnostics. */ }
    return r;
  };
  const onEvent=(e:{type:string;message:string})=>{if(e.type==='failed')failures.push(e.message);};
  stage='debt-readiness';const debt=await runDebt({context,config,tools,budget,infer,onEvent});
  assert.equal(debt.result.status,'completed');assert.equal(debt.trace.length,3);assert.ok(debt.result.findings.length>0);
  stage='goal-allocator';const goals=await runGoals({context,config,tools,budget,infer,onEvent,dependency:{context,result:debt.result,evidence:debt.evidence}});
  assert.equal(goals.result.status,'completed');assert.equal(goals.trace.length,3);
  const planning=(await tools.compare_plans.execute({scope:'snapshot'},context,new AbortController().signal)).data as any;
  assert.equal(planning.alternatives.length,3);assert.equal(planning.budget.available_cents,218500);
  for(const plan of planning.alternatives){
    assert.equal(plan.total_accounted_cents,500000);
    assert.equal(plan.extra_debt_cents+plan.new_goal_contribution_cents+plan.unallocated_cents,218500);
    assert.ok(JSON.stringify(goals.result).includes(plan.id));
  }
  assert.ok([...debt.evidence,...goals.evidence].every(e=>e.source_mode==='fixture'));
  const report={status:'passed',checked_at:new Date().toISOString(),model:config.model,inference_source_mode:'live',financial_source_mode:'fixture',
    total_latency_ms:Date.now()-started,model_calls:budget.calls,request_latency_ms:latencies,debt,goals,planning,
    dependency:'Goal Allocator consumes Debt Readiness for the same user, run, snapshot and accounts',
    limits:{max_tokens:4096,max_model_calls:24,max_tool_rounds:4,specialist_timeout_ms:90000}};
  const json=JSON.stringify(report,null,2);
  if(process.argv.includes('--record'))writeFileSync(new URL('../src/server/agents/planning/acceptance.json',import.meta.url),json+'\n');
  console.log(json);
} catch {
  console.error(JSON.stringify({status:'failed',stage,failures,observed,code:'FP20_SMOKE_FAILED'}));process.exitCode=1;
}
