import type { AgentResult,SpecialistId,ToolContext } from '../../../../contracts/types.ts';
import { runAgent,RunBudget } from '../runtime/index.ts';
import type { RuntimeOptions } from '../runtime/index.ts';
import type { BoundTool } from '../runtime/tools.ts';
import { EvidenceGate,scopedTool } from '../evidence/index.ts';
export const SPECIALISTS:SpecialistId[]=['data-integrity','cash-collision','subscription-detective','deal-scout','debt-readiness','goal-allocator','stress-test','plan-repair'];
const prerequisites:Record<SpecialistId,SpecialistId[]>={
  'data-integrity':[],'cash-collision':['data-integrity'],'subscription-detective':['data-integrity'],'deal-scout':['subscription-detective'],
  'debt-readiness':['cash-collision'],'goal-allocator':['debt-readiness'],'stress-test':['goal-allocator'],'plan-repair':[],
};
const runtimeParent:Partial<Record<SpecialistId,SpecialistId>>={'cash-collision':'data-integrity','deal-scout':'subscription-detective','goal-allocator':'debt-readiness','stress-test':'goal-allocator'};
export function orderedRoles(selected:SpecialistId[]){
  const out:SpecialistId[]=[];const add=(role:SpecialistId)=>{if(!SPECIALISTS.includes(role))throw new Error('ROUTE_INVALID');for(const p of prerequisites[role])add(p);if(!out.includes(role))out.push(role);};
  selected.forEach(add);return out;
}
export function mergeFindings(entries:{role:string;result:AgentResult;claims?:{key:string;amount_cents:number}[]}[]){
  const seen=new Map<string,number>();const conflicts:string[]=[];
  for(const entry of entries)for(const claim of entry.claims??[]){if(seen.has(claim.key) && seen.get(claim.key)!==claim.amount_cents)conflicts.push(claim.key);else seen.set(claim.key,claim.amount_cents);}
  return {findings:entries.flatMap(e=>e.result.findings.map(f=>({...f,id:`${e.role}:${f.id}`}))),conflicts:[...new Set(conflicts)],
    allocation_policy:'Alternatives remain mutually exclusive; no cross-role amounts are summed or accepted.'};
}
export interface CheckupOptions {
  context:ToolContext;config:RuntimeOptions['config'];budget:RunBudget;intent:'cash'|'subscriptions'|'planning'|'stress'|'full';
  authorize:(ctx:ToolContext,signal:AbortSignal)=>Promise<void>;
  toolsFor:(role:SpecialistId)=>Record<string,BoundTool>|null;
  infer?:RuntimeOptions['infer'];signal?:AbortSignal;onEvent?:RuntimeOptions['onEvent'];
}
export async function runCheckup(options:CheckupOptions){
  if(!['cash','subscriptions','planning','stress','full'].includes(options.intent))throw new Error('ROUTE_INVALID');
  const context=structuredClone(options.context);const signal=options.signal??new AbortController().signal;
  await options.authorize(context,signal);
  const gate=new EvidenceGate();const results=new Map<SpecialistId,Awaited<ReturnType<typeof runAgent>>>();
  const steps:{role:SpecialistId;status:string;reason:string;depends_on:SpecialistId[]}[]=[];
  const toolsByRole=new Map(SPECIALISTS.map(role=>[role,role==='plan-repair'?null:options.toolsFor(role)]));
  const allowed:Record<CheckupOptions['intent'],SpecialistId[]>={
    cash:['data-integrity','cash-collision'],subscriptions:['data-integrity','subscription-detective','deal-scout'],
    planning:['data-integrity','cash-collision','debt-readiness','goal-allocator'],stress:['data-integrity','cash-collision','debt-readiness','goal-allocator','stress-test'],full:SPECIALISTS,
  };
  let selected:SpecialistId[]=[];let routed=false;
  const claims=new Map<SpecialistId,{key:string;amount_cents:number}[]>();
  const merged=()=>mergeFindings([...results].map(([role,r])=>({role,result:r.result,claims:claims.get(role)})));
  const expose=()=>({steps,selected_specialists:selected,results:[...results].map(([role,r])=>({role,result:r.result})),...merged()});
  const common:Omit<RuntimeOptions,'role'|'tools'>={context,config:options.config,budget:options.budget,signal,infer:options.infer,onEvent:options.onEvent,beforeModelCall:options.authorize,
    onToolOutput:(ctx,_name,output)=>gate.register(ctx,output),validateResult:(ctx:ToolContext,result:AgentResult)=>{gate.check(ctx,result);}};
  const route=scopedTool('route_specialists',async args=>{
    if(routed)throw new Error('ROUTE_DUPLICATE');routed=true;
    selected=args.specialists as SpecialistId[];
    if(!selected.length || selected.some(r=>!allowed[options.intent].includes(r)))throw new Error('ROUTE_IRRELEVANT');
    const ordered=orderedRoles(selected);
    for(const role of ordered){
      signal.throwIfAborted();await options.authorize(context,signal);
      const dependencies=prerequisites[role];const failed=dependencies.find(d=>!['completed','needs_information'].includes(results.get(d)?.result.status??''));
      let reason=failed?`Dependency ${failed} did not complete.`:'';
      const tools=toolsByRole.get(role);
      if(!reason && role==='plan-repair')reason='Event-only specialist: dispatch an owned changed-data event through repairChangedEvent.';
      if(!reason && !tools)reason='Required data/tool capability unavailable.';
      // Reserve three coordinator calls after routing; each 3-tool specialist
      // may need a fifth model call for its one permitted output repair.
      if(!reason && options.budget.calls+5+3>24)reason='Global model-call budget reserved for coordinator completion.';
      if(reason){steps.push({role,status:'skipped',reason,depends_on:dependencies});continue;}
      const parent=runtimeParent[role];const prior=parent?results.get(parent):undefined;
      const result=await runAgent({...common,role,tools:tools!,onToolOutput:(ctx,name,output)=>{
        common.onToolOutput?.(ctx,name,output);
        const values=(output.data as {canonical_claims?:unknown})?.canonical_claims;
        if(Array.isArray(values))for(const claim of values){
          if(typeof claim.key!=='string' || claim.key.length>100 || !Number.isSafeInteger(claim.amount_cents))throw new Error('EVIDENCE_AMOUNT');
          claims.set(role,[...(claims.get(role)??[]),{key:claim.key,amount_cents:claim.amount_cents}]);
        }
      },...(prior?{dependency:{context,result:prior.result,evidence:prior.evidence}}:{})});
      results.set(role,result);steps.push({role,status:result.result.status,reason:result.result.status==='failed'?'Provider, validation or authorization failure.':'Executed allowed tools with scoped evidence.',depends_on:dependencies});
    }
    for(const role of SPECIALISTS)if(!steps.some(s=>s.role===role))steps.push({role,status:'skipped',reason:'Irrelevant to selected intent/route.',depends_on:prerequisites[role]});
    return expose();
  },{needsInformation:()=>merged().conflicts.length>0,parameters:{type:'object',properties:{scope:{type:'string',enum:['snapshot']},specialists:{type:'array',uniqueItems:true,items:{type:'string',enum:SPECIALISTS}}},required:['scope','specialists'],additionalProperties:false}});
  const read=scopedTool('read_run_findings',async()=>{await options.authorize(context,signal);return expose();},{needsInformation:()=>merged().conflicts.length>0});
  const compare=scopedTool('compare_plans',async()=>{await options.authorize(context,signal);return {...expose(),comparison:'Keep the original per-role alternatives; conflicts require user review.'};},{needsInformation:()=>merged().conflicts.length>0});
  const attach=(tool:BoundTool):BoundTool=>({...tool,async execute(...args){const output=await tool.execute(...args);const childEvidence=[...results.values()].flatMap(r=>r.evidence);return {...output,data:{...output.data as object,known_monetary_facts:gate.monetaryFacts(context,childEvidence.map(e=>e.id))},evidence:[...output.evidence,...childEvidence]};}});
  const coordinator=await runAgent({...common,role:'coordinator',tools:{route_specialists:attach(route),read_run_findings:attach(read),compare_plans:attach(compare)},
    userMessage:`Intent: ${options.intent}. Available specialists: ${JSON.stringify(SPECIALISTS.filter(r=>toolsByRole.get(r)))}. Select only relevant roles from this permitted set: ${JSON.stringify(allowed[options.intent])}. route_specialists executes the server DAG. Use qualitative summaries unless copying a returned finding amount; do not infer extra arithmetic. Always return selected_specialists equal to your route request.`,
    validateResult:(ctx,result)=>{gate.check(ctx,result);if(JSON.stringify([...(result.selected_specialists??[])].sort())!==JSON.stringify([...selected].sort()))throw new Error('ROUTE_RESULT');}});
  return {coordinator,steps,results:[...results].map(([role,result])=>({role,...result})),merge:merged(),model_calls:options.budget.calls,partial:coordinator.result.status==='failed'||merged().conflicts.length>0||steps.some(s=>s.status==='failed'||(s.status==='skipped'&&!s.reason.startsWith('Irrelevant')))};
}
