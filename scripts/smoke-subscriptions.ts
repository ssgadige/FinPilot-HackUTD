import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readConfig, complete } from '../src/server/nemotron/index.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
import { runSubscriptions } from '../src/server/agents/subscriptions.ts';
import { runDeals } from '../src/server/agents/deals.ts';
import { createSubscriptionTools } from '../src/server/agents/subscription-tools.ts';
import { fetchOffers } from '../src/server/offers/source.ts';
import { fixture, context } from './fixtures/fp19.ts';
let stage='configuration'; const failures:string[]=[]; const observed:Record<string,unknown>={};
const finalAmounts:{role:string;amounts:(number|null)[]}[]=[];
observed.final_amounts=finalAmounts;
try {
  const config=readConfig(); const budget=new RunBudget();const started=Date.now();
  stage='public-offer-retrieval';
  const retrieved=await fetchOffers(new AbortController().signal);
  assert.equal(retrieved.availability,'available');assert.equal(retrieved.source_mode,'live');
  const tools=createSubscriptionTools(async()=>fixture(),{retrieve:async()=>retrieved});
  const latencies:number[]=[];
  const infer:typeof complete=async(...args)=>{
    const r=await complete(...args);latencies.push(r.latencyMs);
    if(!r.message.tool_calls?.length) {
      try {
        const output=JSON.parse(r.message.content??'');
        if(Array.isArray(output.findings)) {
          const diagnostic={role:output.agent_id==='deal-scout'?'deal-scout':'subscription-detective',
            amounts:output.findings.map((f:any)=>typeof f.amount_cents==='number'?f.amount_cents:null)};
          finalAmounts.push(diagnostic);
        }
      } catch { /* Never log raw provider content. */ }
    }
    return r;
  };
  const onEvent=(e:{type:string;message:string})=>{if(e.type==='failed')failures.push(e.message);};
  stage='subscription-detective';
  const subscriptions=await runSubscriptions({context,config,tools,budget,infer,onEvent});
  observed.subscriptions_status=subscriptions.result.status;
  observed.subscription_amounts=subscriptions.result.findings.map(f=>f.amount_cents);
  assert.equal(subscriptions.result.status,'completed');
  assert.ok(subscriptions.result.findings.some(f=>f.amount_cents===400 || f.amount_cents===1999));
  stage='deal-scout';
  const deals=await runDeals({context,config,tools,budget,infer,onEvent,dependency:{context,result:subscriptions.result,evidence:subscriptions.evidence}});
  observed.deals_status=deals.result.status;
  observed.deal_amounts=deals.result.findings.map(f=>f.amount_cents);
  assert.equal(deals.result.status,'completed');assert.ok(deals.evidence.some(e=>e.kind==='offer'&&e.source_mode==='live'));
  const comparisons=(await tools.compare_offer_costs.execute({scope:'snapshot'},context,new AbortController().signal)).data as any;
  const comparison=comparisons.comparisons[0].offers[0];
  assert.equal(comparison.promo_applied,false);assert.equal(comparison.realized_savings_cents,0);
  assert.ok(deals.result.findings.some(f=>f.amount_cents===comparison.verified_potential_savings_cents ||
    f.amount_cents===comparison.potential_monthly_savings_cents || f.amount_cents===comparison.monthly_equivalent_cents));
  const report={status:'passed',checked_at:new Date().toISOString(),model:config.model,inference_source_mode:'live',financial_source_mode:'fixture',
    total_latency_ms:Date.now()-started,model_calls:budget.calls,request_latency_ms:latencies,public_retrieval:retrieved,comparisons,
    subscriptions,deals,dependency:'Deal Scout consumed Subscription Detective result in the same authenticated context'};
  const json=JSON.stringify(report,null,2);
  if(process.argv.includes('--record'))writeFileSync(new URL('../src/server/offers/acceptance.json',import.meta.url),json+'\n');
  console.log(json);
} catch {
  console.error(JSON.stringify({status:'failed',stage,failures,observed,code:'FP19_SMOKE_FAILED'}));process.exitCode=1;
}
