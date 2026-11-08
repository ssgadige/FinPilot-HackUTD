import { Store, type Row } from './db';
import { agentResult, role } from './result-schema';
import { iso, token } from './auth';
import { ApiFailure, fail, found } from './errors';
import { Planning, type PlanPayload } from './planning';
import type { ToolContext, AgentResult } from '../../contracts/types';
export interface RunControl {
  signal:AbortSignal;
  beforeCall(kind:'model'|'tool',agent:string):void;
  event(agent:string,type:'started'|'tool_started'|'tool_completed'|'completed'|'failed'|'skipped',message:string):void;
  step(result:AgentResult):void;
}
export interface RunOutput {results:AgentResult[];proposal?:{payload:PlanPayload;parentId?:string};}
export interface Runner {run(intent:string,context:Readonly<ToolContext>,control:RunControl):Promise<AgentResult[]|RunOutput>;}
export class UnavailableRunner implements Runner {
  async run():Promise<AgentResult[]> {fail(503,'runtime_unavailable','Nemotron runtime is not configured');}
}
const safeErrors=new Set(['runtime_unavailable','nemotron_unavailable','NEMOTRON_UNAVAILABLE','NEMOTRON_CONFIG','NEMOTRON_PROVIDER_ERROR','NEMOTRON_INVALID_RESPONSE','NEMOTRON_TIMEOUT','NEMOTRON_CANCELLED','cancelled','run_timeout','run_budget','stale_snapshot','invalid_role','invalid_result','invalid_evidence','invalid_plan','version_conflict','runtime_failed']);
export class Runs {
  private active=new Map<string,AbortController>();
  constructor(readonly store:Store,readonly runner:Runner=new UnavailableRunner(),readonly timeoutMs=90000,readonly planning:Planning=new Planning(store)) {
    store.exec("UPDATE runs SET status='failed',error_code='server_restarted' WHERE status IN ('queued','running','cancelling')");
  }
  get(uid:string,id:string):Row {
    const run=found(this.store.one('SELECT * FROM runs WHERE id=? AND user_id=?',id,uid)),stale=run.snapshot_version!==this.store.user(uid).snapshot_version;
    const steps=this.store.all('SELECT agent_id,status,result_json FROM agent_steps WHERE run_id=? AND user_id=? ORDER BY rowid',id,uid);
    return {...run,stale,steps:steps.map(step=>({...step,result_json:stale?null:step.result_json,result:stale||!step.result_json?null:JSON.parse(step.result_json)})),financial_source_mode:'fixture'};
  }
  enqueue(uid:string,intent:string,key:string,replace=false) {
    const result=this.store.atomic(()=>{
      const previous=this.store.one('SELECT * FROM runs WHERE user_id=? AND idempotency_key=?',uid,key);
      if(previous){if(previous.intent!==intent)fail(409,'idempotency_conflict','Key already used');return previous;}
      if(replace)this.store.exec("UPDATE runs SET status='cancelled',error_code='stale_snapshot' WHERE user_id=? AND status IN ('queued','running','cancelling')",uid);
      else if(this.store.one("SELECT id FROM runs WHERE user_id=? AND status IN ('queued','running','cancelling')",uid))fail(429,'run_busy','A run is already active');
      const id=token();this.store.exec("INSERT INTO runs VALUES(?,?,?,'queued',?,?,?,NULL)",id,uid,intent,this.store.user(uid).snapshot_version,key,iso());
      this.event(uid,id,'coordinator','queued','Run queued');return found(this.store.one('SELECT * FROM runs WHERE id=? AND user_id=?',id,uid));
    });
    setImmediate(()=>{
      // The outer demo-event transaction may have rolled back; never run an orphan.
      if(!this.store.one('SELECT id FROM runs WHERE id=? AND user_id=?',result.id,uid))return;
      if(replace)for(const [id,abort] of this.active)if(this.store.one("SELECT id FROM runs WHERE id=? AND user_id=? AND status='cancelled'",id,uid))abort.abort();
      void this.execute(uid,result.id);
    });return result;
  }
  event(uid:string,id:string,agent:string,type:string,message:string) {
    this.store.exec('INSERT INTO run_events VALUES(?,?,?,?,?,?,?)',token(),id,uid,agent,type,message,iso());
  }
  private validate(uid:string,snapshot:number,result:AgentResult) {
    if(!agentResult.safeParse(result).success||result.snapshot_version!==snapshot)fail(502,'invalid_result','Invalid runtime result');
    for(const finding of result.findings)if(finding.amount_cents!==null&&!finding.evidence_ids.length)fail(502,'invalid_evidence','Financial findings require evidence');
    for(const id of [...result.evidence_ids,...result.findings.flatMap(f=>f.evidence_ids)])this.store.evidence(uid,id);
  }
  private save(uid:string,id:string,result:AgentResult) {
    this.store.exec('DELETE FROM agent_steps WHERE run_id=? AND user_id=? AND agent_id=?',id,uid,result.agent_id);
    this.store.exec('INSERT INTO agent_steps VALUES(?,?,?,?,?,?)',token(),id,uid,result.agent_id,result.status,JSON.stringify(result));
  }
  async execute(uid:string,id:string) {
    const row=this.store.one('SELECT * FROM runs WHERE id=? AND user_id=?',id,uid);if(!row||row.status!=='queued'||this.active.has(id))return;
    const abort=new AbortController();this.active.set(id,abort);let models=0,tools=0,timedOut=false;const roleTools=new Map<string,number>();
    const interrupt=new Promise<never>((_,reject)=>abort.signal.addEventListener('abort',()=>reject(new ApiFailure(409,timedOut?'run_timeout':'cancelled','Run interrupted')),{once:true}));
    const timer=setTimeout(()=>{timedOut=true;abort.abort();},this.timeoutMs);
    this.store.exec("UPDATE runs SET status='running' WHERE id=? AND user_id=?",id,uid);
    const context=Object.freeze({userId:uid,snapshotVersion:row.snapshot_version,allowedAccountIds:Object.freeze(this.store.accounts(uid).map(a=>a.id)) as unknown as string[],runId:id});
    const check=()=>{
      if(abort.signal.aborted||this.get(uid,id).status!=='running')fail(409,'cancelled','Run cancelled');
      if(this.store.user(uid).snapshot_version!==context.snapshotVersion)fail(409,'stale_snapshot','Snapshot changed');
    };
    try {
      this.event(uid,id,'coordinator','started','Run started');
      const output=await Promise.race([this.runner.run(row.intent,context,{
        signal:abort.signal,
        beforeCall:(kind,agent)=>{
          check();if(!role.safeParse(agent).success)fail(400,'invalid_role','Unknown role');
          if(kind==='model'&&++models>24||kind==='tool'&&++tools>96)fail(429,'run_budget','Run budget exceeded');
          if(kind==='tool'){const count=(roleTools.get(agent)??0)+1;roleTools.set(agent,count);if(count>4)fail(429,'run_budget','Role tool budget exceeded');}
          this.event(uid,id,agent,kind==='tool'?'tool_started':'started',kind==='tool'?'Authorized tool call':'Nemotron request');
        },
        event:(agent,type)=>{check();if(!role.safeParse(agent).success)fail(400,'invalid_role','Unknown role');this.event(uid,id,agent,type,'Agent '+type.replaceAll('_',' '));},
        step:result=>{check();this.validate(uid,context.snapshotVersion,result);this.store.atomic(()=>this.save(uid,id,result));},
      }),interrupt]);
      check();const {results,proposal}=Array.isArray(output)?{results:output,proposal:undefined}:output;
      if(!Array.isArray(results)||results.length<1||results.length>10)fail(502,'invalid_result','Invalid runtime result');
      for(const result of results)this.validate(uid,context.snapshotVersion,result);
      if(results.some(r=>r.status==='failed'))fail(502,'runtime_failed','A required specialist failed');
      this.store.atomic(()=>{
        for(const result of results)this.save(uid,id,result);
        this.store.exec("UPDATE runs SET status='completed' WHERE id=? AND user_id=?",id,uid);
        if(proposal)this.planning.propose(uid,id,proposal.payload,proposal.parentId);
        if(results.some(r=>r.status==='needs_information'||r.status==='skipped'))this.store.exec("UPDATE runs SET status='needs_information' WHERE id=? AND user_id=?",id,uid);
        this.event(uid,id,'coordinator','completed',proposal?'Run completed; plan revision proposed':'Run completed');
      });
    }catch(error) {
      const supplied=error instanceof Error&&'code' in error?String(error.code):'runtime_failed';const code=safeErrors.has(supplied)?supplied:'runtime_failed';
      const cancelled=code==='cancelled';this.store.exec('UPDATE runs SET status=?,error_code=? WHERE id=? AND user_id=?',cancelled?'cancelled':'failed',code,id,uid);
      this.event(uid,id,'coordinator','failed',cancelled?'Run cancelled':'Run could not complete');
    }finally{clearTimeout(timer);this.active.delete(id);}
  }
  cancel(uid:string,id:string) {
    const run=this.get(uid,id);
    if(['queued','running','cancelling'].includes(run.status)) {
      this.store.exec("UPDATE runs SET status='cancelled',error_code='cancelled' WHERE id=? AND user_id=?",id,uid);this.active.get(id)?.abort();
      this.event(uid,id,'coordinator','failed','Run cancellation requested');
    }return this.get(uid,id);
  }
  events(uid:string,id:string,cursor?:string) {
    const run=this.get(uid,id);if(run.stale)return {items:[],next_cursor:null,stale:true};
    let after=0;if(cursor)after=found(this.store.one('SELECT rowid FROM run_events WHERE id=? AND run_id=? AND user_id=?',cursor,id,uid)).rowid;
    const items=this.store.all('SELECT id,run_id,agent_id,type,at,message FROM run_events WHERE user_id=? AND run_id=? AND rowid>? ORDER BY rowid LIMIT 200',uid,id,after);
    return {items,next_cursor:items.at(-1)?.id??cursor??null,stale:false};
  }
  async idle() {await new Promise(resolve=>setImmediate(resolve));while(this.active.size)await new Promise(resolve=>setTimeout(resolve,5));}
}
