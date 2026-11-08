import { DatabaseSync } from 'node:sqlite';
import { chmodSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { ToolContext } from '../../../../contracts/types.ts';
import { runAgent,RunBudget } from '../runtime/index.ts';
import type { RuntimeOptions } from '../runtime/index.ts';
import { createPlanningTools } from '../planning/tools.ts';
import type { PlanningSnapshot } from '../planning/types.ts';
import { makePlans,validateSnapshot,reserveBudget } from '../planning/calculations.ts';
import { integer,sum } from '../planning/math.ts';
import { EvidenceGate,scopedTool } from '../evidence/index.ts';
export interface ChangedEvent {idempotencyKey:string;kind:'surprise_expense';accountId:string;amountCents:number;expectedSnapshotVersion:number;}
interface State {snapshot:PlanningSnapshot;accepted:{version:number;snapshotVersion:number;plan:ReturnType<typeof makePlans>['alternatives'][number]};proposals:unknown[];}
export class RepairStore {
  #db:DatabaseSync;
  constructor(path:string){
    this.#db=new DatabaseSync(path);if(path!==':memory:')chmodSync(path,0o600);
    this.#db.exec(`CREATE TABLE IF NOT EXISTS agent_repair_state(user_id TEXT PRIMARY KEY,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_repair_events(user_id TEXT NOT NULL,event_key TEXT NOT NULL,fingerprint TEXT NOT NULL,status TEXT NOT NULL,payload TEXT,PRIMARY KEY(user_id,event_key));`);
  }
  close(){this.#db.close();}
  read(userId:string):State {
    const row=this.#db.prepare('SELECT payload FROM agent_repair_state WHERE user_id=?').get(userId) as {payload:string}|undefined;
    if(!row)throw new Error('REPAIR_NOT_FOUND');return JSON.parse(row.payload);
  }
  initialize(ctx:ToolContext,snapshot:PlanningSnapshot,planId:string,confirmation:boolean){
    if(confirmation!==true)throw new Error('CONFIRMATION_REQUIRED');validateSnapshot(snapshot,ctx);
    const plan=makePlans(snapshot).alternatives.find(p=>p.id===planId);if(!plan)throw new Error('REPAIR_PLAN');
    this.#db.prepare('INSERT INTO agent_repair_state(user_id,payload) VALUES(?,?)').run(ctx.userId,JSON.stringify({snapshot,accepted:{version:1,snapshotVersion:ctx.snapshotVersion,plan},proposals:[]}));
  }
  begin(ctx:ToolContext,event:ChangedEvent){
    if(event.kind!=='surprise_expense' || !event.idempotencyKey || event.idempotencyKey.length>100 || event.expectedSnapshotVersion!==ctx.snapshotVersion)throw new Error('REPAIR_EVENT');
    integer(event.amountCents,1,10000000);
    const fingerprint=createHash('sha256').update(JSON.stringify([event.kind,event.accountId,event.amountCents,event.expectedSnapshotVersion,[...ctx.allowedAccountIds].sort()])).digest('hex');
    this.#db.exec('BEGIN IMMEDIATE');
    try{
      const old=this.#db.prepare('SELECT * FROM agent_repair_events WHERE user_id=? AND event_key=?').get(ctx.userId,event.idempotencyKey) as {fingerprint:string;status:string;payload:string|null}|undefined;
      if(old){if(old.fingerprint!==fingerprint)throw new Error('REPAIR_IDEMPOTENCY_CONFLICT');this.#db.exec('COMMIT');return {cached:true,status:old.status,outcome:old.payload?JSON.parse(old.payload):null};}
      const before=this.read(ctx.userId);validateSnapshot(before.snapshot,ctx);
      const after=structuredClone(before.snapshot);const account=after.accounts.find(a=>a.id===event.accountId);
      if(!account || !['checking','savings','wallet'].includes(account.kind))throw new Error('ACCOUNT_SCOPE');
      account.balanceCents=sum([account.balanceCents,-event.amountCents]);after.version++;
      const nextCtx={...ctx,snapshotVersion:after.version};validateSnapshot(after,nextCtx);
      this.#db.prepare('INSERT INTO agent_repair_events VALUES(?,?,?,?,?)').run(ctx.userId,event.idempotencyKey,fingerprint,'processing',null);
      this.#db.prepare('UPDATE agent_repair_state SET payload=? WHERE user_id=?').run(JSON.stringify({...before,snapshot:after}),ctx.userId);
      this.#db.exec('COMMIT');return {cached:false,before,after,nextCtx};
    }catch(error){this.#db.exec('ROLLBACK');throw error;}
  }
  fail(userId:string,eventKey:string,outcome:unknown){this.#db.prepare('UPDATE agent_repair_events SET status=?,payload=? WHERE user_id=? AND event_key=?').run('failed',JSON.stringify(outcome),userId,eventKey);}
  finish(ctx:ToolContext,event:ChangedEvent,acceptedVersion:number,proposal:unknown,outcome:unknown){
    this.#db.exec('BEGIN IMMEDIATE');
    try{
      const current=this.read(ctx.userId);
      if(current.snapshot.version!==ctx.snapshotVersion || current.accepted.version!==acceptedVersion)throw new Error('REPAIR_STALE');
      const state={...current,proposals:proposal?[...current.proposals,proposal]:current.proposals};
      this.#db.prepare('UPDATE agent_repair_state SET payload=? WHERE user_id=?').run(JSON.stringify(state),ctx.userId);
      this.#db.prepare('UPDATE agent_repair_events SET status=?,payload=? WHERE user_id=? AND event_key=?').run(proposal?'proposed':'failed',JSON.stringify(outcome),ctx.userId,event.idempotencyKey);
      this.#db.exec('COMMIT');
    }catch(error){this.#db.exec('ROLLBACK');throw error;}
  }
}
export async function repairChangedEvent(options:{store:RepairStore;context:ToolContext;event:ChangedEvent;config:RuntimeOptions['config'];budget:RunBudget;
  authorize:(ctx:ToolContext,signal:AbortSignal)=>Promise<void>;signal?:AbortSignal;infer?:RuntimeOptions['infer'];demoMode:boolean;}){
  if(options.demoMode!==true)throw new Error('DEMO_MODE_REQUIRED');
  const ctx=structuredClone(options.context);const event=structuredClone(options.event);const signal=options.signal??new AbortController().signal;
  await options.authorize(ctx,signal);signal.throwIfAborted();
  const start=options.store.begin(ctx,event);
  if(start.cached)return {status:start.status,replayed:true as const,inference_source_mode:'cached',new_model_calls:0,outcome:start.outcome};
  const {before,after,nextCtx}=start;if(!before || !after || !nextCtx)throw new Error('REPAIR_STATE');
  const gate=new EvidenceGate();const activity:{role:string;type:string;message:string}[]=[];
  const common:Omit<RuntimeOptions,'role'|'tools'>={onEvent:(e)=>activity.push({role:e.agent_id,type:e.type,message:e.message}),context:nextCtx,config:options.config,budget:options.budget,signal,infer:options.infer,
    onToolOutput:(context,_name,output)=>gate.register(context,output),validateResult:(context,result)=>{gate.check(context,result);}};
  const loader=async()=>{await options.authorize(nextCtx,signal);return structuredClone(after);};
  common.beforeModelCall=async()=>{await options.authorize(nextCtx,signal);};
  const planningTools=createPlanningTools(loader);
  const compact=(p:typeof before.accepted.plan|null)=>p?{id:p.id,extra_debt_cents:p.extra_debt_cents,new_goal_contribution_cents:p.new_goal_contribution_cents,total_accounted_cents:p.total_accounted_cents,
    estimated_total_interest_cents:p.estimated_total_interest_cents,estimated_debt_free_date:p.estimated_debt_free_date,
    projected_closing_cash_cents:p.projected_closing_cash_cents,total_remaining_goal_cents:p.total_remaining_goal_cents,
    account_allocations:p.account_allocations,debt_allocations:p.debt_allocations,goal_allocations:p.goal_allocations}:null;
  const candidates=makePlans(after);const candidate=candidates.alternatives.find(p=>p.id===before.accepted.plan.id)??candidates.alternatives[0]??null;
  const version=before.accepted.version+before.proposals.length+1;
  const revision={version,status:'proposed',parent_version:before.accepted.version,snapshot_version:after.version,requires_confirmation:true,
    before:compact(before.accepted.plan),after:compact(candidate),
    diff:{cash_change_cents:-event.amountCents,extra_debt_change_cents:candidate?candidate.extra_debt_cents-before.accepted.plan.extra_debt_cents:null,
      goal_contribution_change_cents:candidate?candidate.new_goal_contribution_cents-before.accepted.plan.new_goal_contribution_cents:null},
    candidate,accepted_plan_retained:true,reason:candidates.reason};
  const protect=async(handler:()=>unknown)=>{await options.authorize(nextCtx,signal);validateSnapshot(after,nextCtx);return handler();};
  const tools={
    get_plan_version:scopedTool('get_plan_version',async()=>protect(()=>({accepted_version:before.accepted.version,accepted_snapshot_version:before.accepted.snapshotVersion,status:'accepted',plan:compact(before.accepted.plan)})),{sourceMode:after.sourceMode}),
    get_changed_events:scopedTool('get_changed_events',async()=>protect(()=>({kind:event.kind,account_id:event.accountId,expense_cents:event.amountCents,before_snapshot_version:before.snapshot.version,after_snapshot_version:after.version})),{sourceMode:after.sourceMode}),
    forecast_cash:scopedTool('forecast_cash',async()=>protect(()=>({before:reserveBudget(before.snapshot),after:reserveBudget(after)})),{sourceMode:after.sourceMode}),
    propose_plan_revision:scopedTool('propose_plan_revision',async()=>protect(()=>({...revision,candidate:undefined})),{sourceMode:after.sourceMode,needsInformation:()=>candidate===null}),
  };
  try{
    const debt=await runAgent({...common,role:'debt-readiness',tools:planningTools});
    if(debt.result.status==='failed')throw new Error('REPAIR_DEPENDENCY');
    const goals=await runAgent({...common,role:'goal-allocator',tools:planningTools,dependency:{context:nextCtx,result:debt.result,evidence:debt.evidence}});
    if(goals.result.status==='failed')throw new Error('REPAIR_DEPENDENCY');
    const repair=await runAgent({...common,role:'plan-repair',tools,dependency:{context:nextCtx,result:goals.result,evidence:goals.evidence}});
    if(!['completed','needs_information'].includes(repair.result.status))throw new Error('REPAIR_MODEL_FAILED');
    signal.throwIfAborted();const outcome={status:'proposed' as const,inference_source_mode:'live',replayed:false as const,context:nextCtx,debt,goals,repair,revision,model_calls:options.budget.calls};
    options.store.finish(nextCtx,event,before.accepted.version,revision,outcome);return outcome;
  }catch{
    const outcome={status:'failed' as const,inference_source_mode:'live',replayed:false as const,accepted_plan_retained:true,error:'REPAIR_FAILED',activity};
    options.store.fail(ctx.userId,event.idempotencyKey,outcome);return outcome;
  }
}
