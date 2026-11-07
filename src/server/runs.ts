import { Store } from './db';
import { agentResult, role } from './result-schema';
import { iso, token } from './auth';
import { fail, found } from './errors';
import type { ToolContext, AgentResult } from '../../contracts/types';
export interface RunControl {
  signal: AbortSignal;
  // Runner must call before every model/tool invocation; cancellation and snapshot checked each time.
  beforeCall(kind:'model'|'tool',agent:string):void;
  event(agent:string,type:'started'|'tool_started'|'tool_completed'|'completed'|'failed'|'skipped',message:string):void;
}
export interface Runner { run(intent:string,context:Readonly<ToolContext>,control:RunControl):Promise<AgentResult[]>; }
// Lane C provides the real coordinator/specialist DAG. Missing runtime fails visibly, never fixture success.
export class UnavailableRunner implements Runner {
  async run():Promise<AgentResult[]> { fail(503,'runtime_unavailable','Nemotron agent runtime is not installed'); }
}
export class Runs {
  private active=new Map<string,AbortController>();
  constructor(readonly store:Store,readonly runner:Runner=new UnavailableRunner(),readonly timeoutMs=90000) {
    // Single process prototype: don't leave runs looking active after a process restart.
    store.exec("UPDATE runs SET status='failed',error_code='server_restarted' WHERE status IN ('queued','running','cancelling')");
  }
  get(uid:string,id:string): import('./db').Row {
    const r=found(this.store.one('SELECT * FROM runs WHERE id=? AND user_id=?',id,uid));
    const stale=r.snapshot_version!==this.store.user(uid).snapshot_version;
    return {...r,stale,steps:stale?[]:this.store.all('SELECT agent_id,status,result_json FROM agent_steps WHERE run_id=? AND user_id=?',id,uid)};
  }
  enqueue(uid:string,intent:string,key:string) {
    const existing=this.store.one('SELECT * FROM runs WHERE user_id=? AND idempotency_key=?',uid,key);
    if(existing) {if(existing.intent!==intent) fail(409,'idempotency_conflict','Key already used');return existing;}
    if(this.store.one("SELECT id FROM runs WHERE user_id=? AND status IN ('queued','running','cancelling')",uid)) fail(429,'run_busy','A run is already active');
    const id=token();this.store.exec("INSERT INTO runs VALUES(?,?,?,'queued',?,?,?,NULL)",id,uid,intent,this.store.user(uid).snapshot_version,key,iso());
    this.event(uid,id,'coordinator','queued','Run queued');
    setImmediate(()=>{void this.execute(uid,id);});
    return found(this.store.one('SELECT * FROM runs WHERE id=? AND user_id=?',id,uid));
  }
  event(uid:string,id:string,agent:string,type:string,message:string) {
    this.store.exec('INSERT INTO run_events VALUES(?,?,?,?,?,?,?)',token(),id,uid,agent,type,message,iso());
  }
  async execute(uid:string,id:string) {
    const run=this.get(uid,id);if(run.status!=='queued') return;
    const abort=new AbortController();this.active.set(id,abort);let calls=0,tools=0,timedOut=false;const rounds=new Map<string,number>();
    const interrupted=new Promise<never>((_,reject)=>abort.signal.addEventListener('abort',()=>reject(Object.assign(new Error('Run interrupted'),{code:timedOut?'run_timeout':'cancelled'})),{once:true}));
    const timer=setTimeout(()=>{timedOut=true;abort.abort();},this.timeoutMs);
    this.store.exec("UPDATE runs SET status='running' WHERE id=? AND user_id=?",id,uid);
    const context=Object.freeze({userId:uid,snapshotVersion:run.snapshot_version,allowedAccountIds:Object.freeze(this.store.accounts(uid).map(a=>a.id)) as unknown as string[],runId:id});
    const check=()=> {
      if(abort.signal.aborted || this.get(uid,id).status==='cancelling') fail(409,'cancelled','Run cancelled or timed out');
      if(this.store.user(uid).snapshot_version!==context.snapshotVersion) fail(409,'stale_snapshot','Snapshot changed');
    };
    try {
      this.event(uid,id,'coordinator','started','Run started');
      const results=await Promise.race([this.runner.run(run.intent,context,{signal:abort.signal,beforeCall:(kind,agent)=>{check();if(!role.safeParse(agent).success) fail(400,'invalid_role','Unknown agent role');if(kind==='tool'){rounds.set(agent,(rounds.get(agent)||0)+1);if(rounds.get(agent)!>4)fail(429,'run_budget','Role tool budget exceeded');}if(kind==='model'&&++calls>24||kind==='tool'&&++tools>96) fail(429,'run_budget','Run call budget exceeded');this.event(uid,id,agent,kind==='tool'?'tool_started':'started',kind==='tool'?'Authorized tool call':'Nemotron request');},event:(agent,type,message)=>{check();if(!role.safeParse(agent).success)fail(400,'invalid_role','Unknown agent role');this.event(uid,id,agent,type,`Agent ${type.replaceAll('_',' ')}`);}}),interrupted]);
      check();
      // Reject foreign or stale evidence before persisting any results. The runtime validates its schema.
      if(!Array.isArray(results)||results.length<1||results.length>10)fail(502,'invalid_result','Invalid runtime result');
      for(const r of results) {
        if(!agentResult.safeParse(r).success)fail(502,'invalid_result','Invalid runtime result');
        if(r.findings.some(f=>f.amount_cents!==null&&!f.evidence_ids.length))fail(502,'invalid_evidence','Financial findings require evidence');
        if(r.snapshot_version!==context.snapshotVersion) fail(409,'stale_snapshot','Invalid result snapshot');
        for(const e of [...r.evidence_ids,...r.findings.flatMap(f=>f.evidence_ids)]) this.store.evidence(uid,e);
      }
      this.store.atomic(()=> {
        for(const r of results) this.store.exec('INSERT INTO agent_steps VALUES(?,?,?,?,?,?)',token(),id,uid,r.agent_id,r.status,JSON.stringify(r));
        this.store.exec("UPDATE runs SET status='completed' WHERE id=? AND user_id=?",id,uid);
        this.event(uid,id,'coordinator','completed','Run completed');
      });
    } catch(error) {
      const code=error instanceof Error && 'code' in error?String(error.code):'runtime_failed';
      this.store.exec('UPDATE runs SET status=?,error_code=? WHERE id=? AND user_id=?',code==='cancelled'?'cancelled':'failed',code,id,uid);
      this.event(uid,id,'coordinator','failed',code==='runtime_unavailable'?'Nemotron runtime unavailable':'Run did not complete');
    } finally {clearTimeout(timer);this.active.delete(id);}
  }
  cancel(uid:string,id:string) {
    const run=this.get(uid,id);
    if(['queued','running','cancelling'].includes(run.status)) {
      this.store.exec('UPDATE runs SET status=? WHERE id=? AND user_id=?',run.status==='queued'?'cancelled':'cancelling',id,uid);this.active.get(id)?.abort();
    }
    return this.get(uid,id);
  }
  events(uid:string,id:string,cursor?:string) {
    this.get(uid,id);
    let rowid=0;if(cursor) {const event=found(this.store.one('SELECT rowid FROM run_events WHERE id=? AND run_id=? AND user_id=?',cursor,id,uid));rowid=event.rowid;}
    const items=this.store.all('SELECT id,run_id,agent_id,type,at,message FROM run_events WHERE user_id=? AND run_id=? AND rowid>? ORDER BY rowid LIMIT 200',uid,id,rowid);
    return {items,next_cursor:items.at(-1)?.id??cursor??null};
  }
}
