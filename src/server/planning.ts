import { z } from 'zod';
import { Store, LIABILITIES } from './db';
import { fail, found } from './errors';
import { iso, token } from './auth';
import { Finance } from './finance';
import { calculation, integer } from './tools/finance';
import type { Offer } from '../../contracts/types';

const id = z.string().min(1).max(200);
const cents = z.number().int().min(0).max(100_000_000);
export const planPayload = z.strictObject({
  allocations: z.array(z.strictObject({
    kind: z.enum(['goal_contribution', 'extra_debt_payment']),
    target_id: id, monthly_cents: cents, day_of_month: z.number().int().min(1).max(28),
  })).max(20),
  reserve_cents: cents,
  evidence_ids: z.array(id).max(100),
  assumptions: z.array(z.string().max(1000)).max(30),
});
export type PlanPayload = z.infer<typeof planPayload>;
export type Scenario = {kind:'surprise_expense';expense_cents:number;plan_id?:string}
  | {kind:'delayed_income';delay_days:number;plan_id?:string}
  | {kind:'income_drop';income_drop_pct:number;plan_id?:string};
export interface OfferResolver {
  list(uid:string,subscriptionId:string,signal:AbortSignal):Promise<{items:Offer[];source_mode:string;availability:string}>;
}
export class Planning {
  constructor(readonly store:Store,readonly offers?:OfferResolver) {}
  goal(uid:string,id:string) { return found(this.store.one('SELECT * FROM goals WHERE id=? AND user_id=?',id,uid)); }
  createGoal(uid:string,body:{title:string;target_cents:number;deadline:string;priority:number}) {
    return this.store.atomic(()=>{
      const id=token();this.store.exec('INSERT INTO goals(id,user_id,title,target_cents,deadline,priority) VALUES(?,?,?,?,?,?)',id,uid,body.title,body.target_cents,body.deadline,body.priority);
      this.store.invalidate(uid);return this.goal(uid,id);
    });
  }
  updateGoal(uid:string,id:string,body:{title?:string;target_cents?:number;deadline?:string;priority?:number}) {
    return this.store.atomic(()=>{
      const old=this.goal(uid,id);
      this.store.exec('UPDATE goals SET title=?,target_cents=?,deadline=?,priority=?,version=version+1 WHERE id=? AND user_id=?',body.title??old.title,body.target_cents??old.target_cents,body.deadline??old.deadline,body.priority??old.priority,id,uid);
      this.store.invalidate(uid);return this.goal(uid,id);
    });
  }
  deleteGoal(uid:string,id:string) {
    return this.store.atomic(()=>{this.goal(uid,id);this.store.exec('DELETE FROM goals WHERE id=? AND user_id=?',id,uid);this.store.invalidate(uid);});
  }
  subscription(uid:string,id:string) { return found(this.store.scoped('subscriptions',uid).find(s=>s.id===id)); }
  preferences(uid:string,id:string,body:{usage_confirmed?:string;preferences?:Record<string,string|boolean>;confirmation:true}) {
    return this.store.atomic(()=>{
      const s=this.subscription(uid,id);
      this.store.exec("UPDATE subscriptions SET usage_confirmed=?,preferences_json=?,status='confirmed' WHERE id=? AND user_id=?",body.usage_confirmed??s.usage_confirmed,JSON.stringify(body.preferences??JSON.parse(s.preferences_json)),id,uid);
      this.store.invalidate(uid);return this.subscription(uid,id);
    });
  }
  async listOffers(uid:string,id:string) {
    this.subscription(uid,id);
    if(!this.offers)fail(503,'offers_unavailable','Offer adapter is not configured');
    const result=await this.offers.list(uid,id,AbortSignal.timeout(10000));
    this.subscription(uid,id);return result;
  }
  async action(uid:string,body:{subscription_id:string;offer_id?:string;cancel_intention?:boolean;confirmation:true}) {
    this.subscription(uid,body.subscription_id);
    const offer=body.offer_id?found((await this.listOffers(uid,body.subscription_id)).items.find(o=>o.id===body.offer_id)):undefined;
    return this.store.atomic(()=>{
      this.subscription(uid,body.subscription_id);
      const id=token();const payload={...body,...(offer?{offer}:{}),realized_savings_cents:0};
      this.store.exec("INSERT INTO subscription_actions VALUES(?,?,?,?,'planned',?,?)",id,uid,body.subscription_id,offer?'switch_intention':'cancel_intention',JSON.stringify(payload),iso());
      this.store.invalidate(uid);
      return {id,status:'planned',source_mode:offer?.source_mode??'fixture',realized_savings_cents:0,requires_external_action:true};
    });
  }
  plan(uid:string,id:string) { return found(this.store.one('SELECT * FROM plans WHERE id=? AND user_id=?',id,uid)); }
  view(uid:string,id:string) {
    const p=this.plan(uid,id),stale=p.snapshot_version!==this.store.user(uid).snapshot_version;
    return {...p,payload_json:stale?null:p.payload_json,payload:stale?null:JSON.parse(p.payload_json),stale,source_mode:'fixture'};
  }
  list(uid:string) {return this.store.all('SELECT id FROM plans WHERE user_id=? ORDER BY created_at DESC,id',uid).map(p=>this.view(uid,p.id));}
  validatePayload(uid:string,input:unknown):PlanPayload {
    const result=planPayload.safeParse(input);if(!result.success)fail(502,'invalid_plan','Plan proposal is invalid');
    const p=result.data,seen=new Set<string>();
    for(const a of p.allocations) {
      if(seen.has(a.kind+':'+a.target_id))fail(502,'invalid_plan','Repeated allocation');seen.add(a.kind+':'+a.target_id);
      if(a.kind==='goal_contribution')this.goal(uid,a.target_id);
      else if(!LIABILITIES.has(this.store.account(uid,a.target_id).kind))fail(400,'invalid_plan','Debt allocation requires a linked liability');
    }
    integer(p.allocations.reduce((sum,a)=>sum+a.monthly_cents,0),0,100_000_000);
    for(const e of p.evidence_ids)this.store.evidence(uid,e);
    return p;
  }
  // Internal server seam; the API never accepts a caller/model supplied proposal payload.
  propose(uid:string,runId:string,input:unknown,parentId?:string) {
    return this.store.atomic(()=>{
      const run=found(this.store.one("SELECT * FROM runs WHERE id=? AND user_id=? AND status='completed'",runId,uid));
      if(run.snapshot_version!==this.store.user(uid).snapshot_version)fail(409,'stale_snapshot','Rerun against current snapshot');
      const parent=parentId?this.plan(uid,parentId):undefined;
      if(parent&&parent.status!=='accepted')fail(409,'version_conflict','Parent plan is no longer accepted');
      const payload=this.validatePayload(uid,input),id=token();
      this.store.exec("INSERT INTO plans VALUES(?,?,?,?,'proposed',?,?,?,?)",id,uid,runId,(parent?.version??0)+1,run.snapshot_version,parentId??null,JSON.stringify(payload),iso());
      return this.view(uid,id);
    });
  }
  accept(uid:string,id:string,body:{expected_version:number;confirmation:true;idempotency_key:string}) {
    return this.store.atomic(()=>{
      const plan=this.plan(uid,id);
      if(plan.snapshot_version!==this.store.user(uid).snapshot_version)fail(409,'version_conflict','Plan snapshot is stale');
      const replay=this.store.one('SELECT * FROM plan_acceptances WHERE user_id=? AND key=?',uid,body.idempotency_key);
      if(replay) {
        if(replay.plan_id!==id||replay.expected_version!==body.expected_version)fail(409,'idempotency_conflict','Key already used');
        if(plan.status!=='accepted')fail(409,'version_conflict','Plan is no longer accepted');
        return this.view(uid,id);
      }
      if(plan.status!=='proposed'||plan.version!==body.expected_version)fail(409,'version_conflict','Plan changed');
      if(plan.parent_plan_id&&this.plan(uid,plan.parent_plan_id).status!=='accepted')fail(409,'version_conflict','Accepted plan changed');
      this.validatePayload(uid,JSON.parse(plan.payload_json));
      this.store.exec("UPDATE plans SET status='superseded' WHERE user_id=? AND status='accepted'",uid);
      const update=this.store.exec("UPDATE plans SET status='accepted',version=version+1 WHERE id=? AND user_id=? AND status='proposed' AND version=?",id,uid,body.expected_version);
      if(!update.changes)fail(409,'version_conflict','Plan already changed');
      this.store.exec("UPDATE plans SET status='stale' WHERE user_id=? AND status='proposed' AND id<>?",uid,id);
      const accepted=this.view(uid,id);this.store.exec('INSERT INTO plan_acceptances VALUES(?,?,?,?,?)',uid,body.idempotency_key,id,body.expected_version,JSON.stringify(accepted));return accepted;
    });
  }
  scenario(uid:string,input:Scenario,finance:Finance) {
    let plan:ReturnType<Planning['plan']>|undefined,payload:PlanPayload|undefined;
    if(input.plan_id) {
      plan=this.plan(uid,input.plan_id);
      if(plan.snapshot_version!==this.store.user(uid).snapshot_version||!['proposed','accepted'].includes(plan.status))fail(409,'stale_snapshot','Plan is stale; request a revision');
      payload=this.validatePayload(uid,JSON.parse(plan.payload_json));
    }
    const result=finance.forecast(uid,90,input.kind==='surprise_expense'?input.expense_cents:0,input.kind==='delayed_income'?input.delay_days:0,input.kind==='income_drop'?input.income_drop_pct:0);
    let allocated=0;
    const dated_balances=result.dated_balances.map((row,index)=>{
      if(index>0)for(const a of payload?.allocations??[])if(Number(row.date.slice(-2))===a.day_of_month)allocated+=a.monthly_cents;
      return {date:row.date,balance_cents:integer(row.balance_cents-allocated,-100_000_000_000)};
    });
    const low=dated_balances.reduce((a,b)=>a.balance_cents<=b.balance_cents?a:b),reserve=payload?.reserve_cents??0;
    const calculated=calculation('plan_scenario',{input,plan_version:plan?.version,snapshot_version:result.snapshot_version},
      {...result,kind:input.kind,plan_id:plan?.id??null,plan_version:plan?.version??null,dated_balances,low_cash_date:low.date,low_cash_cents:low.balance_cents,reserve_cents:reserve,reserve_breached:low.balance_cents<reserve,proposal_only:true},
      [...result.assumptions,'Goal contributions and EXTRA debt payments reserve liquid cash once on each future due date; existing scheduled minimum payments remain in the baseline. Intentions never create realized subscription savings.']);
    return {...calculated,evidence_ids:[finance.persistCalculation(uid,calculated,calculated)]};
  }
}
