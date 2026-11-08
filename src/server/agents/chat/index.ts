import type { AgentResult,ToolContext } from '../../../../contracts/types.ts';
import type { RuntimeOptions } from '../runtime/index.ts';
import { runAgent,RunBudget } from '../runtime/index.ts';
import { EvidenceGate,scopedTool,scopeKey } from '../evidence/index.ts';
import { coachTools, COACH_TOOL_NAMES, type CoachQueries } from './coach-tools.ts';
import { MEMORY_MAX_TURNS, MEMORY_MAX_TURN_CHARS, sanitizeConversationText, type ConversationContext } from './memory.ts';
export interface ChatFinding {context:ToolContext;result:AgentResult;toolOutputs:import('../runtime/tools.ts').ToolOutput[];}
export interface ChatSnapshot {context:ToolContext;overview:unknown;findings:ChatFinding[];plan:{context:ToolContext;payload:unknown}|null;}
export async function chat(options:{context:ToolContext;message:string;config:RuntimeOptions['config'];budget:RunBudget;
  load:(ctx:ToolContext,signal:AbortSignal)=>Promise<ChatSnapshot>;allowRunRequest?:boolean;
  requestRun?:(ctx:ToolContext,idempotencyKey:string)=>Promise<string>;infer?:RuntimeOptions['infer'];signal?:AbortSignal;history?:ConversationContext;
  /** Server-supplied read-only financial queries; omitted in unit tests of the base chat. */
  queries?:CoachQueries;}){
  if(!options.message.trim() || options.message.length>2000 || /nvapi-|\b(?:password|otp|verification code|api key|session token)\b|^\s*\d{6}\s*$/i.test(options.message))throw new Error('CHAT_INPUT');
  const toolEvidence=new Set<string>();
  const context=structuredClone(options.context);const signal=options.signal??new AbortController().signal;const gate=new EvidenceGate();
  const history=structuredClone(options.history??{turns:[],selected_evidence_id:null,reset:'new_or_expired'});
  if(history.turns.length>MEMORY_MAX_TURNS||history.turns.some(t=>!['user','assistant'].includes(t.speaker)||typeof t.text!=='string'||t.text.length>MEMORY_MAX_TURN_CHARS||sanitizeConversationText(t.text,[options.config.apiKey])===null))throw new Error('CHAT_INPUT');
  history.turns=history.turns.map(t=>({...t,text:sanitizeConversationText(t.text,[options.config.apiKey])!.slice(0,MEMORY_MAX_TURN_CHARS)}));
  const read=async()=>{
    signal.throwIfAborted();const s=structuredClone(await options.load(context,signal));
    if(scopeKey(s.context)!==scopeKey(context) || s.findings.length>20 || s.findings.some(f=>f.result.snapshot_version!==context.snapshotVersion))throw new Error('CHAT_OWNER');
    const own=(c:ToolContext)=>c.userId===context.userId && c.snapshotVersion===context.snapshotVersion && JSON.stringify([...c.allowedAccountIds].sort())===JSON.stringify([...context.allowedAccountIds].sort());
    const check=new EvidenceGate();
    for(const finding of s.findings){
      if(!own(finding.context))throw new Error('CHAT_OWNER');
      for(const output of finding.toolOutputs)check.register(finding.context,output);
    }
    for(const finding of s.findings)check.check(finding.context,finding.result);
    if(s.plan && !own(s.plan.context))throw new Error('CHAT_OWNER');
    return s;
  };
  let requested:string|null=null;
  let inheritedEvidence:import('../../../../contracts/types.ts').Evidence[]=[];
  const tools:Record<string,import('../runtime/tools.ts').BoundTool>={
    ...(options.queries?coachTools(options.queries,context.userId,read,[options.message,...history.turns.filter(t=>t.speaker==='user').map(t=>t.text)].join('\n')):{}),
    read_overview:scopedTool('read_overview',async()=>({overview:(await read()).overview})),
    read_findings:scopedTool('read_findings',async()=>{
      const snapshot=await read();inheritedEvidence=snapshot.findings.flatMap(f=>f.toolOutputs.flatMap(o=>o.evidence));const check=new EvidenceGate();for(const f of snapshot.findings)for(const o of f.toolOutputs)check.register(f.context,o);
      return {findings:snapshot.findings.map(f=>f.result),known_monetary_facts:snapshot.findings.flatMap(f=>check.monetaryFacts(f.context,f.result.evidence_ids))};
    }),
    read_plan:scopedTool('read_plan',async()=>({plan:(await read()).plan?.payload??null})),
    request_checkup:scopedTool('request_checkup',async()=>{
      await read();if(options.allowRunRequest!==true || !options.requestRun)throw new Error('CHAT_RUN_NOT_AUTHORIZED');
      requested??=await options.requestRun(context,`chat:${context.runId}`);return {requested_run_id:requested,status:'queued',not_executed_by_chat:true};
    }),
  };
  const originalRead=tools.read_findings.execute;tools.read_findings={...tools.read_findings,async execute(...args){const output=await originalRead(...args);return {...output,evidence:[...output.evidence,...inheritedEvidence]};}};
  const offered=[...(options.allowRunRequest?['read_overview','read_findings','read_plan','request_checkup']:['read_overview','read_findings','read_plan']),
    ...(options.queries?COACH_TOOL_NAMES:[])];
  const result=await runAgent({role:'chat',context,config:options.config,budget:options.budget,signal,infer:options.infer,tools,offeredTools:offered,userMessage:options.message,
    ...(history.turns.length||history.selected_evidence_id?{conversationContext:JSON.stringify({turns:history.turns,selected_evidence_id:history.selected_evidence_id})}:{}),
    beforeModelCall:async()=>{await read();},
    onToolOutput:(ctx,_name,output)=>{gate.register(ctx,output);for(const e of output.evidence)toolEvidence.add(e.id);},
    // A chat answer is judged as a whole: every dollar amount, date and amount_cents must
    // come from a tool output gathered for THIS user in THIS reply, but a finding may quote
    // a value from another tool than the one it cites. Unsourced or model-computed money still fails.
    validateResult:(ctx,result)=>{const ids=[...toolEvidence];gate.check(ctx,{...result,evidence_ids:[...new Set([...result.evidence_ids,...ids])],findings:result.findings.map(f=>({...f,evidence_ids:ids}))});}});
  return {reply:result.result.status==='failed'?'Chat is unavailable; no execution is claimed.':[result.result.headline,...result.result.findings.map(f=>f.summary)].join('\n'),
    evidence_ids:result.result.evidence_ids,requested_run_id:requested,result};
}
