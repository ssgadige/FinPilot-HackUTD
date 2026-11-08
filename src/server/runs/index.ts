import type { AgentResult, RunEvent, ToolContext } from '../../../contracts/types';
import { Store, type Row } from '../db';
import { Auth, iso, token } from '../auth';
import { ApiFailure, fail, found } from '../errors';
import { Finance } from '../finance';
import { CoachData } from '../coach-data';
import { Planning, type PlanPayload } from '../planning';
import { idempotent } from '../simulator';
import { readConfig, type Config } from '../nemotron/index';
import { BackendAgentBridge } from '../agents/integration/backend';
import { runCheckup, type CheckupOptions } from '../agents/coordinator';
import { chat, type ChatFinding } from '../agents/chat';
import { runAgent, RunBudget, type RuntimeOptions } from '../agents/runtime';
import { EvidenceGate, scopedTool } from '../agents/evidence';
import { addDays, integer } from '../tools/finance';
import { SessionConversationMemory, sanitizeConversationText, MEMORY_TTL_MS, MEMORY_MAX_TURNS } from '../agents/chat/memory';

export type Intent = CheckupOptions['intent'];
export type DemoEvent = {kind:'surprise_expense';amount_cents:number;idempotency_key:string}
  | {kind:'delayed_income';days:number;idempotency_key:string};
interface RunRow extends Row {id:string;user_id:string;intent:string;status:string;snapshot_version:number;error_code:string|null;created_at:string;}
interface StateRow extends Row {context_json:string;request_json:string;result_json:string|null;model_calls:number;}
type AgentExecution = Awaited<ReturnType<typeof runAgent>>;
interface PublicResult {role_steps:unknown[];findings:AgentResult['findings'];trace:AgentExecution['trace'];partial:boolean;proposed_plan_id?:string;}
interface Job {userId:string;controller:AbortController;promise:Promise<void>;}
export interface RunOptions {config?:()=>Config;infer?:RuntimeOptions['infer'];demoMode?:boolean;}

/** One process owns this SQLite prototype's bounded queue. Never expose options to clients. */
export class Runs {
  readonly bridge:BackendAgentBridge;
  private jobs=new Map<string,Job>();
  private chats=new Map<AbortController,{userId:string;sessionKey:string;done:Promise<void>}>();
  private chatLocks=new Set<string>();
  private memory:SessionConversationMemory;
  constructor(readonly store:Store,readonly auth:Auth,readonly finance:Finance,readonly planning:Planning,readonly options:RunOptions={}) {
    this.bridge=new BackendAgentBridge(store);
    // Do not silently replay provider calls or changed-data effects after a restart.
    for(const run of store.all<RunRow>("SELECT * FROM runs WHERE status IN ('queued','running')")) {
      store.exec("UPDATE runs SET status='failed',error_code='interrupted' WHERE id=? AND user_id=?",run.id,run.user_id);
      this.event(run.user_id,run.id,'coordinator','failed','Run interrupted by server restart; request a new run.');
    }
    this.memory=new SessionConversationMemory(()=>this.auth.now(),(uid,key)=>this.chatSessionActive(uid,key));
  }
  private chatSessionActive(uid:string,key:string){
    if(!/^[a-f0-9]{64}$/.test(key))return false;
    const session=this.store.one('SELECT expires_at,last_seen_at FROM sessions WHERE user_id=? AND token_hash=?',uid,key);
    return !!session&&Date.parse(session.expires_at)>this.auth.now()&&Date.parse(session.last_seen_at)>this.auth.now()-1800000;
  }
  private assertChatSession(uid:string,key:string){if(!this.chatSessionActive(uid,key))fail(401,'unauthenticated','Complete password and email verification');}
  forgetChatSession(uid:string,key:string){
    this.memory.forgetSession(uid,key);
    for(const [controller,chat]of this.chats)if(chat.userId===uid&&chat.sessionKey===key)controller.abort();
  }
  private config(){try{return (this.options.config??readConfig)();}catch{fail(503,'ai_unavailable','Nemotron is not configured');}}
  private row(uid:string,id:string){return found(this.store.one<RunRow>('SELECT * FROM runs WHERE id=? AND user_id=?',id,uid));}
  private state(uid:string,id:string){return found(this.store.one<StateRow>('SELECT * FROM run_state WHERE run_id=? AND user_id=?',id,uid));}
  private scoped(uid:string,id:string){
    const row=this.row(uid,id),state=this.state(uid,id);const context=JSON.parse(state.context_json) as ToolContext;
    const visible=new Set(this.store.accounts(uid).map(a=>a.id));
    return {row,state,context,stale:row.snapshot_version!==this.store.user(uid).snapshot_version||context.allowedAccountIds.some(a=>!visible.has(a))};
  }
  private event(uid:string,id:string,role:RunEvent['agent_id'],type:RunEvent['type'],message:string){
    this.store.exec('INSERT INTO run_events VALUES(?,?,?,?,?,?,?)',token(),id,uid,role,type,message,iso());
  }
  private onEvent(uid:string,id:string){return (e:RunEvent)=>{
    // Runtime emits only safe status codes/tool names, never prompts/arguments.
    if(this.row(uid,id).status==='cancelled')return;
    this.store.exec('INSERT INTO run_events VALUES(?,?,?,?,?,?,?)',e.id,id,uid,e.agent_id,e.type,e.message,e.at);
    this.store.exec(`INSERT INTO agent_steps VALUES(?,?,?,?,?,NULL)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status`,`${id}:${e.agent_id}`,id,uid,e.agent_id,
      e.type==='started'?'running':e.type==='failed'?'failed':e.type==='completed'?'completed':'running');
  };}
  private insert(uid:string,intent:string,key:string,request:unknown){
    if(this.store.one("SELECT id FROM runs WHERE user_id=? AND status IN ('queued','running')",uid))fail(429,'run_in_progress','Wait for or cancel the active run');
    if(this.jobs.size>=2)fail(429,'run_busy','Run capacity is busy');
    const id=token(),ctx=this.bridge.contextFor(uid,id);
    if(!ctx.allowedAccountIds.length)fail(409,'accounts_required','Link and select accounts before running a checkup');
    this.store.exec("INSERT INTO runs(id,user_id,intent,status,snapshot_version,idempotency_key,created_at) VALUES(?,?,?,'queued',?,?,?)",id,uid,intent,ctx.snapshotVersion,`run:${key}`,iso());
    this.store.exec('INSERT INTO run_state(run_id,user_id,context_json,request_json) VALUES(?,?,?,?)',id,uid,JSON.stringify(ctx),JSON.stringify(request));
    this.event(uid,id,'coordinator','queued','Run queued.');
    return {run_id:id,status:'queued',snapshot_version:ctx.snapshotVersion,source_mode:'fixture'};
  }
  start(uid:string,input:{intent:Intent;goal_id?:string;idempotency_key:string}) {
    // Idempotency is durable and precedes provider availability/budget checks.
    const prior=this.store.one('SELECT * FROM request_keys WHERE user_id=? AND scope=? AND key=?',uid,'run',input.idempotency_key);
    if(prior)return idempotent(this.store,uid,'run',input.idempotency_key,input,()=>{throw Error('unreachable');});
    const config=this.config();
    if(input.goal_id)this.planning.goal(uid,input.goal_id);
    this.auth.throttle(`agent-run:${uid}`,10,3600000);
    const queued=idempotent(this.store,uid,'run',input.idempotency_key,input,()=>this.insert(uid,input.intent,input.idempotency_key,input));
    this.enqueue(uid,queued.run_id,config);return queued;
  }
  private enqueue(uid:string,id:string,config:Config){
    const controller=new AbortController();
    const promise=new Promise<void>(resolve=>setTimeout(resolve,0)).then(()=>this.execute(uid,id,config,controller.signal))
      .catch(()=>{this.failed(uid,id,'execution_failed');}).finally(()=>this.jobs.delete(id));
    this.jobs.set(id,{userId:uid,controller,promise});
  }
  private failed(uid:string,id:string,code:string){
    if(this.row(uid,id).status==='cancelled')return;
    this.store.exec("UPDATE runs SET status='failed',error_code=? WHERE id=? AND user_id=?",code,id,uid);
    this.event(uid,id,'coordinator','failed',code==='stale_snapshot'?'Snapshot changed; start a fresh run.':'Run could not complete; no execution or acceptance is claimed.');
  }
  private saveAgent(uid:string,id:string,ctx:ToolContext,execution:AgentExecution){
    this.store.exec('INSERT INTO agent_steps VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,result_json=excluded.result_json',`${id}:${execution.result.agent_id}`,id,uid,execution.result.agent_id,execution.result.status,JSON.stringify(execution.result));
    this.store.exec('INSERT INTO agent_records VALUES(?,?,?,?)',token(),id,uid,JSON.stringify({context:ctx,result:execution.result,toolOutputs:execution.serverToolOutputs} satisfies ChatFinding));
    for(const e of execution.evidence){
      // Evidence IDs are runtime hashes containing owner/run/snapshot scope.
      const existing=this.store.one('SELECT run_id FROM evidence WHERE id=? AND user_id=?',e.id,uid);
      if(existing && existing.run_id!==id)throw Error('EVIDENCE_OWNER');
      const output=execution.serverToolOutputs.find(o=>o.evidence.some(item=>item.id===e.id));
      if(!existing)this.store.exec('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)',e.id,uid,id,e.kind,e.source_id,e.source_mode,e.observed_at,
        JSON.stringify({source:e.source_id,data:output?.data??null,assumptions:output?.assumptions??[]}));
    }
  }
  private async execute(uid:string,id:string,config:Config,signal:AbortSignal){
    const {row,context,stale}=this.scoped(uid,id);
    if(row.status==='cancelled')return;
    if(stale){this.failed(uid,id,'stale_snapshot');return;}
    this.store.exec("UPDATE runs SET status='running' WHERE id=? AND user_id=?",id,uid);
    const budget=new RunBudget();
    try {
      let result:PublicResult;
      if(row.intent==='repair')result=await this.repair(uid,id,context,config,budget,signal);
      else {
        const checked=await runCheckup({context,config,budget,signal,infer:this.options.infer,intent:row.intent as Intent,
          authorize:(ctx)=>this.bridge.authorize(ctx),toolsFor:(role)=>this.bridge.toolsFor(role),onEvent:this.onEvent(uid,id)});
        signal.throwIfAborted();await this.bridge.authorize(context);
        for(const execution of [...checked.results,checked.coordinator])this.saveAgent(uid,id,context,execution);
        for(const step of checked.steps)if(step.status==='skipped'){
          this.store.exec('INSERT INTO agent_steps VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,result_json=excluded.result_json',`${id}:${step.role}`,id,uid,step.role,'skipped',JSON.stringify(step));
          this.event(uid,id,step.role,'skipped',step.reason);
        }
        if(checked.coordinator.result.status==='failed')throw Error('provider_or_validation_failure');
        result={role_steps:checked.steps,findings:checked.merge.findings,trace:[...checked.results,checked.coordinator].flatMap(r=>r.trace),partial:checked.partial};
      }
      signal.throwIfAborted();await this.bridge.authorize(context);
      this.store.exec("UPDATE runs SET status='completed',error_code=NULL WHERE id=? AND user_id=?",id,uid);
      this.store.exec('UPDATE run_state SET result_json=? WHERE run_id=? AND user_id=?',JSON.stringify(result),id,uid);
    }catch{
      if(!signal.aborted)this.failed(uid,id,this.scoped(uid,id).stale?'stale_snapshot':'provider_or_validation_failure');
    }finally{this.store.exec('UPDATE run_state SET model_calls=? WHERE run_id=? AND user_id=?',budget.calls,id,uid);}
  }
  view(uid:string,id:string){
    const {row,state,stale}=this.scoped(uid,id);const result=state.result_json?JSON.parse(state.result_json) as PublicResult:null;
    const steps=this.store.all('SELECT agent_id,status FROM agent_steps WHERE run_id=? AND user_id=? ORDER BY rowid',id,uid);
    return {run_id:id,status:row.status,snapshot_version:row.snapshot_version,stale,error_code:row.error_code,created_at:row.created_at,
      role_steps:stale?steps:result?.role_steps??steps,findings:stale?[]:result?.findings??[],trace:stale?[]:result?.trace??[],
      partial:result?.partial??row.status==='failed',model_calls:state.model_calls,source_mode:'fixture',
      inference_source_mode:state.model_calls?'live':null,proposed_plan_id:stale?null:result?.proposed_plan_id??null};
  }
  events(uid:string,id:string,cursor?:string){
    const {stale}=this.scoped(uid,id);
    if(cursor!==undefined&&!/^(0|[1-9]\d{0,14})$/.test(cursor))fail(400,'invalid_cursor','Invalid event cursor');
    const after=Number(cursor??0);
    const rows=this.store.all('SELECT rowid AS sequence,id,run_id,agent_id,type,message,at FROM run_events WHERE run_id=? AND user_id=? AND rowid>? ORDER BY rowid LIMIT 201',id,uid,after);
    const more=rows.length>200;rows.splice(200);
    return {items:rows.map(({sequence,...event})=>{void sequence;return event;}),next_cursor:String(rows.at(-1)?.sequence??after),has_more:more,stale};
  }
  cancel(uid:string,id:string){
    const row=this.row(uid,id);if(!['queued','running'].includes(row.status))return {run_id:id,status:row.status};
    this.store.exec("UPDATE runs SET status='cancelled',error_code=NULL WHERE id=? AND user_id=?",id,uid);
    this.jobs.get(id)?.controller.abort();this.event(uid,id,'coordinator','completed','Cancellation requested; no new tools or provider calls will start.');
    return {run_id:id,status:'cancelled'};
  }
  async drain(){await Promise.all([...this.jobs.values()].map(j=>j.promise));}
  async close(){this.memory.dispose();const waiting=[...this.chats.values()].map(chat=>chat.done);for(const c of this.chats.keys())c.abort();for(const [id,job] of this.jobs)this.cancel(job.userId,id);await this.drain();await Promise.all(waiting);}

  demoEvent(uid:string,input:DemoEvent){
    if(this.options.demoMode!==true)fail(403,'demo_disabled','Demo events are disabled');
    const previous=this.store.one('SELECT * FROM request_keys WHERE user_id=? AND scope=? AND key=?',uid,'demo-event',input.idempotency_key);
    if(previous)return idempotent(this.store,uid,'demo-event',input.idempotency_key,input,()=>{throw Error('unreachable');});
    const config=this.config();
    if(this.jobs.size>=2)fail(429,'run_busy','Run capacity is busy');
    // throttle() uses its own transaction, so reserve it before the atomic event.
    this.auth.throttle(`demo-event:${uid}`,10,3600000);
    const result=idempotent(this.store,uid,'demo-event',input.idempotency_key,input,()=>{
      if(this.store.one("SELECT id FROM runs WHERE user_id=? AND status IN ('queued','running')",uid))fail(429,'run_in_progress','Wait for or cancel the active run');
      const accounts=this.store.accounts(uid).filter(a=>['checking','savings'].includes(a.kind));
      if(!accounts.length)fail(409,'accounts_required','Link liquid accounts before injecting an event');
      const eventId=token();let payload:Record<string,unknown>={kind:input.kind};
      if(input.kind==='surprise_expense'){
        const a=accounts.find(a=>a.kind==='checking')??accounts[0];
        integer(input.amount_cents,1,100_000_000);const balance=integer(a.balance_cents-input.amount_cents,-100_000_000_000);
        this.store.exec('UPDATE accounts SET balance_cents=? WHERE id=? AND user_id=?',balance,a.id,uid);
        this.store.exec('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,NULL)',eventId,uid,a.id,this.finance.asOf(),'Demo surprise expense','demo_expense',-input.amount_cents);
        payload={...payload,account_id:a.id,amount_cents:input.amount_cents};
      }else{
        integer(input.days,1,60);
        const context={...this.bridge.contextFor(uid,'event'),allowedAccountIds:accounts.map(a=>a.id)};
        const incomes=this.incomeDates(uid,context).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
        const next=incomes[0];if(!next)fail(409,'income_required','No selected scheduled income is available');
        payload={...payload,account_id:next.accountId,scheduled_item_id:next.id,original_date:next.date,delayed_date:addDays(next.date,input.days),days:input.days};
      }
      this.store.exec('INSERT INTO demo_events VALUES(?,?,?,?,?,?)',eventId,uid,input.kind,JSON.stringify(payload),input.idempotency_key,iso());
      this.store.invalidate(uid);
      // insert() throttles before this transaction in normal runs; demo uses its own limit.
      const run=this.insertEventRun(uid,eventId);
      return {event_id:eventId,kind:input.kind,...run,requires_confirmation:true,source_mode:'fixture'};
    });
    this.enqueue(uid,result.run_id,config);return result;
  }
  private insertEventRun(uid:string,eventId:string){
    const id=token(),context=this.bridge.contextFor(uid,id);
    this.store.exec("INSERT INTO runs(id,user_id,intent,status,snapshot_version,idempotency_key,created_at) VALUES(?,?,'repair','queued',?,?,?)",id,uid,context.snapshotVersion,`event:${eventId}`,iso());
    this.store.exec('INSERT INTO run_state(run_id,user_id,context_json,request_json) VALUES(?,?,?,?)',id,uid,JSON.stringify(context),JSON.stringify({event_id:eventId}));
    this.event(uid,id,'plan-repair','queued','Changed snapshot queued for proposed repair; accepted plan retained.');
    return {run_id:id,status:'queued',snapshot_version:context.snapshotVersion};
  }
  private incomeDates(uid:string,ctx:ToolContext){
    const shifts=this.store.all("SELECT payload_json FROM demo_events WHERE user_id=? AND kind='delayed_income' ORDER BY rowid",uid).map(e=>JSON.parse(e.payload_json));
    return this.store.scoped('scheduled_items',uid).filter(s=>s.direction==='income'&&ctx.allowedAccountIds.includes(s.account_id)).map(s=>{
      let date='';for(let n=1;n<=30;n++){const d=addDays(this.finance.asOf(),n);if(Number(d.slice(-2))===s.day_of_month){date=d;break;}}
      for(const shift of shifts)if(shift.scheduled_item_id===s.id&&shift.original_date===date)date=shift.delayed_date;
      return {id:s.id,accountId:s.account_id,date};
    });
  }
  private async repair(uid:string,id:string,ctx:ToolContext,config:Config,budget:RunBudget,signal:AbortSignal):Promise<PublicResult>{
    const request=JSON.parse(this.state(uid,id).request_json);
    const event=found(this.store.one('SELECT payload_json FROM demo_events WHERE id=? AND user_id=?',request.event_id,uid));
    const changed=JSON.parse(event.payload_json);
    const accepted=this.store.one("SELECT id,version,payload_json FROM plans WHERE user_id=? AND status='accepted'",uid);
    const before=accepted?JSON.parse(accepted.payload_json) as PlanPayload:null;
    // Application allocations are MONTHLY, unlike the specialist fixture's one-period model.
    // A conservative review proposal pauses only optional allocations; scheduled minimums
    // and bills remain in the forecast. It never invents account funding metadata.
    const candidate:PlanPayload={allocations:[],reserve_cents:before?.reserve_cents??0,evidence_ids:[],assumptions:[
      'Conservative monthly revision pauses optional goal contributions and extra debt payments pending review; scheduled bills and minimums remain.',
      'Goal funding accounts and debt payment dates are unavailable; updated Goal Allocator did not run.',
      'Proposal only. Accepted plan is retained; explicit confirmation is required.']};
    const guard=async()=>{signal.throwIfAborted();await this.bridge.authorize(ctx);};
    const gate=new EvidenceGate();
    const tool=(name:string,read:()=>unknown)=>scopedTool(name,async()=>{await guard();return read();},{needsInformation:()=>true});
    const projection=(p:PlanPayload|null)=>p?{allocations:p.allocations,reserve_cents:p.reserve_cents}:null;
    const forecast=()=>this.finance.forecast(uid,90);
    const tools={
      get_plan_version:tool('get_plan_version',()=>({accepted_plan_id:accepted?.id??null,accepted_version:accepted?.version??null,before:projection(before),accepted_plan_retained:true})),
      get_changed_events:tool('get_changed_events',()=>changed),
      forecast_cash:tool('forecast_cash',forecast),
      propose_plan_revision:tool('propose_plan_revision',()=>({before:projection(before),after:projection(candidate),requires_confirmation:true,
        optional_monthly_change_cents:-(before?.allocations.reduce((sum,a)=>sum+a.monthly_cents,0)??0),
        reserve_breached:forecast().low_cash_cents<candidate.reserve_cents,missing_data:candidate.assumptions.slice(1,2),accepted_plan_retained:true})),
    };
    const execution=await runAgent({role:'plan-repair',context:ctx,config,budget,signal,tools,infer:this.options.infer,
      beforeModelCall:guard,
      dependencyUnavailableReason:'Application goal funding accounts and debt payment dates are missing; no Goal Allocator execution is claimed.',
      onEvent:this.onEvent(uid,id),onToolOutput:(c,_name,output)=>gate.register(c,output),validateResult:(c,result)=>gate.check(c,result)});
    await guard();this.saveAgent(uid,id,ctx,execution);
    if(execution.result.status==='failed')throw Error('repair_failed');
    candidate.evidence_ids=execution.result.evidence_ids;
    // Make proposal creation atomic with run completion and parent validation.
    if(accepted){const current=this.planning.plan(uid,accepted.id);if(current.status!=='accepted'||current.version!==accepted.version)fail(409,'version_conflict','Accepted plan changed');}
    const proposal=this.planning.propose(uid,id,candidate,accepted?.id,true);
    return {role_steps:[{role:'plan-repair',status:execution.result.status,reason:'Conservative application revision; planning metadata unavailable.'}],
      findings:execution.result.findings,trace:execution.trace,partial:true,proposed_plan_id:proposal.id};
  }

  async message(uid:string,input:{message:string;conversation_id?:string},sessionKey:string){
    // Check ownership before provider availability, and never store raw user chat.
    const conversation=input.conversation_id?found(this.store.one('SELECT id FROM conversations WHERE id=? AND user_id=?',input.conversation_id,uid)).id:token();
    if(!input.message.trim()||input.message.length>2000||/nvapi-|\b(?:password|otp|verification code|api key|session token)\b|^\s*\d{6}\s*$/i.test(input.message))fail(400,'invalid_message','Message contains unsupported or credential fields');
    this.assertChatSession(uid,sessionKey);
    const config=this.config();
    const secrets=[config.apiKey,this.auth.config.secret,process.env.SMTP_PASS??'',process.env.SESSION_SECRET??''];
    const message=sanitizeConversationText(input.message,secrets);
    if(!message||message.length>2000)fail(400,'invalid_message','Message contains unsupported or credential fields');
    const lock=JSON.stringify([uid,sessionKey,conversation]);
    if(this.chatLocks.has(lock))fail(429,'chat_busy','Wait for the current reply in this conversation');
    this.auth.throttle(`agent-chat:${uid}`,20,3600000);
    if(this.chats.size>=2)fail(429,'chat_busy','Chat capacity is busy');
    const controller=new AbortController();let finish!:()=>void;
    const done=new Promise<void>(resolve=>{finish=resolve;});
    this.chats.set(controller,{userId:uid,sessionKey,done});this.chatLocks.add(lock);
    try{
      const context=this.bridge.contextFor(uid,token());const budget=new RunBudget();
      let history=this.memory.read(uid,sessionKey,conversation,context);
      if(history.selected_evidence_id){try{this.store.evidence(uid,history.selected_evidence_id);}catch{this.memory.forgetConversation(uid,sessionKey,conversation);history={turns:[],selected_evidence_id:null,reset:'source_unavailable'};}}
      const selected=message.match(/\bevidence\s+(calc-[A-Za-z0-9_-]{1,180})\b/)?.[1];
      if(selected){this.store.evidence(uid,selected);history.selected_evidence_id=selected;}
      const response=await chat({context,message,history,config,budget,signal:controller.signal,infer:this.options.infer,
        queries:new CoachData(this.store,this.finance),
        allowRunRequest:/^\s*(?:please\s+)?(?:run|start) (?:a )?(?:financial )?checkup[.!]?\s*$/i.test(message),
        requestRun:async(_ctx,key)=>this.start(uid,{intent:'full',idempotency_key:key}).run_id,
        load:async()=>{
          this.assertChatSession(uid,sessionKey);controller.signal.throwIfAborted();
          await this.bridge.authorize(context);
          const findings:ChatFinding[]=this.store.all('SELECT ar.payload_json FROM agent_records ar JOIN runs r ON r.id=ar.run_id AND r.user_id=ar.user_id WHERE ar.user_id=? AND r.snapshot_version=? AND r.status=? ORDER BY ar.rowid DESC LIMIT 20',uid,context.snapshotVersion,'completed').map(r=>JSON.parse(r.payload_json));
          const plan=this.store.one("SELECT id FROM plans WHERE user_id=? AND snapshot_version=? AND status IN ('accepted','proposed') ORDER BY created_at DESC LIMIT 1",uid,context.snapshotVersion);
          const overview=this.finance.overview(uid);
          return {context,overview:{...overview,upcoming_bills:overview.upcoming_bills.map(b=>({id:b.id,account_id:b.account_id,
            amount_cents:b.amount_cents,day_of_month:b.day_of_month,direction:b.direction,essential:b.essential}))},
            findings,plan:plan?{context,payload:this.planning.view(uid,plan.id).payload}:null};
        }});
      controller.signal.throwIfAborted();this.assertChatSession(uid,sessionKey);await this.bridge.authorize(context);
      if(response.result.result.status==='failed'){
        // Log only the safe runtime code (e.g. INVALID_AGENT_RESULT_CURRENCY); never message text or secrets.
        const code=response.result.events.findLast(e=>e.type==='failed')?.message??'AGENT_EXECUTION_FAILED';
        console.warn(`[chat] reply rejected: ${/^[A-Z_]{3,80}$/.test(code)?code:'AGENT_EXECUTION_FAILED'}`);
        fail(502,'chat_failed','Nemotron chat could not complete safely');
      }
      const reply=sanitizeConversationText(response.reply,secrets);
      if(!reply)fail(502,'chat_failed','Nemotron chat could not complete safely');
      this.store.atomic(()=>{
        // A chat calculation needs a durable current-snapshot parent just like
        // checkup evidence. Inherited findings keep their original source run.
        this.store.exec("INSERT INTO runs(id,user_id,intent,status,snapshot_version,idempotency_key,created_at) VALUES(?,?,'chat','completed',?,?,?)",
          context.runId,uid,context.snapshotVersion,`chat-evidence:${context.runId}`,iso());
        const publicResult:PublicResult={role_steps:[{role:'chat',status:response.result.result.status}],findings:response.result.result.findings,
          trace:response.result.trace,partial:response.result.result.status==='needs_information'};
        this.store.exec('INSERT INTO run_state(run_id,user_id,context_json,request_json,result_json,model_calls) VALUES(?,?,?,?,?,?)',
          context.runId,uid,JSON.stringify(context),'{}',JSON.stringify(publicResult),budget.calls);
        this.store.exec('INSERT INTO agent_steps VALUES(?,?,?,?,?,?)',`${context.runId}:chat`,context.runId,uid,'chat',response.result.result.status,JSON.stringify(response.result.result));
        for(const output of response.result.serverToolOutputs)for(const evidence of output.evidence){
          if(this.store.one('SELECT id FROM evidence WHERE id=? AND user_id=?',evidence.id,uid))continue;
          this.store.exec('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)',evidence.id,uid,context.runId,evidence.kind,evidence.source_id,evidence.source_mode,
            evidence.observed_at,JSON.stringify({source:evidence.source_id,data:output.data,assumptions:output.assumptions}));
        }
        for(const event of response.result.events)this.store.exec('INSERT INTO run_events VALUES(?,?,?,?,?,?,?)',event.id,context.runId,uid,event.agent_id,event.type,event.message,event.at);
        if(!input.conversation_id)this.store.exec('INSERT INTO conversations VALUES(?,?,?)',conversation,uid,iso());
        this.store.exec('INSERT INTO chat_messages VALUES(?,?,?,?,?,?)',token(),conversation,uid,'assistant',reply,iso());
        this.store.exec('DELETE FROM chat_messages WHERE conversation_id=? AND user_id=? AND id NOT IN (SELECT id FROM chat_messages WHERE conversation_id=? AND user_id=? ORDER BY rowid DESC LIMIT 20)',conversation,uid,conversation,uid);
      });
      this.memory.save(uid,sessionKey,conversation,context,history,message,reply,history.selected_evidence_id);
      const saved=this.memory.read(uid,sessionKey,conversation,context);
      return {reply,evidence_ids:response.evidence_ids,requested_run_id:response.requested_run_id,conversation_id:conversation,source_mode:'fixture',inference_source_mode:'live',
        context:{mode:'session_only',retained_turns:saved.turns.length,max_turns:MEMORY_MAX_TURNS,expires_after_seconds:MEMORY_TTL_MS/1000,snapshot_version:context.snapshotVersion,reset:history.reset}};
    }catch(error){if(error instanceof ApiFailure)throw error;
      const code=error instanceof Error&&/^[A-Z_]{3,80}$/.test(error.message)?error.message:'UNEXPECTED_ERROR';
      console.warn(`[chat] request failed: ${code}`);
      fail(502,'chat_failed','Nemotron chat could not complete safely');}
    finally{this.chats.delete(controller);this.chatLocks.delete(lock);finish();}
  }
}
