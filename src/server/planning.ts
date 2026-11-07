import { Store } from './db';
import { fail, found } from './errors';
import { iso, token } from './auth';
import { idempotent } from './simulator';
export class Planning {
  constructor(readonly store:Store) {}
  goal(uid:string,id:string) { return found(this.store.one('SELECT * FROM goals WHERE id=? AND user_id=?',id,uid)); }
  createGoal(uid:string,body:{title:string;target_cents:number;deadline:string;priority:number}) {
    const id=token();this.store.exec('INSERT INTO goals(id,user_id,title,target_cents,deadline,priority) VALUES(?,?,?,?,?,?)',id,uid,body.title,body.target_cents,body.deadline,body.priority);this.store.invalidate(uid);return this.goal(uid,id);
  }
  updateGoal(uid:string,id:string,body:{target_cents?:number;deadline?:string;priority?:number}) {
    return this.store.atomic(()=> {const old=this.goal(uid,id);this.store.exec('UPDATE goals SET target_cents=?,deadline=?,priority=?,version=version+1 WHERE id=? AND user_id=?',body.target_cents??old.target_cents,body.deadline??old.deadline,body.priority??old.priority,id,uid);this.store.invalidate(uid);return this.goal(uid,id);});
  }
  subscription(uid:string,id:string) { return found(this.store.scoped('subscriptions',uid).find(s=>s.id===id)); }
  preferences(uid:string,id:string,body:{usage_confirmed?:string;preferences?:Record<string,string|boolean>;confirmation:true}) {
    const s=this.subscription(uid,id);this.store.exec("UPDATE subscriptions SET usage_confirmed=?,preferences_json=?,status='confirmed' WHERE id=? AND user_id=?",body.usage_confirmed??s.usage_confirmed,JSON.stringify(body.preferences??JSON.parse(s.preferences_json)),id,uid);this.store.invalidate(uid);return this.subscription(uid,id);
  }
  action(uid:string,body:{subscription_id:string;offer_id?:string;cancel_intention?:boolean;confirmation:true}) {
    this.subscription(uid,body.subscription_id);
    // Offer IDs must come from the lane-C offer adapter. No fabricated savings or unverified offers.
    if(body.offer_id) fail(503,'offers_unavailable','Offer adapter is not installed');
    const id=token();this.store.exec("INSERT INTO subscription_actions VALUES(?,?,?,?,'planned',?,?)",id,uid,body.subscription_id,'cancel_intention',JSON.stringify(body),iso());
    return {id,status:'planned',realized_savings_cents:0,requires_external_action:true};
  }
  plan(uid:string,id:string) { return found(this.store.one('SELECT * FROM plans WHERE id=? AND user_id=?',id,uid)); }
  list(uid:string) {const snapshot=this.store.user(uid).snapshot_version;return this.store.all('SELECT * FROM plans WHERE user_id=? ORDER BY created_at DESC',uid).map(p=>({...p,payload_json:p.snapshot_version===snapshot?p.payload_json:null,payload:p.snapshot_version===snapshot?JSON.parse(p.payload_json):null,stale:p.snapshot_version!==snapshot}));}
  // Server-only seam for the evidence-gated lane-C runner. Never called directly with client/model JSON.
  propose(uid:string,runId:string,payload:unknown,parentId?:string) {
    const run=found(this.store.one("SELECT * FROM runs WHERE id=? AND user_id=? AND status='completed'",runId,uid));
    if(run.snapshot_version!==this.store.user(uid).snapshot_version) fail(409,'stale_snapshot','Rerun against current snapshot');
    const parent=parentId?this.plan(uid,parentId):undefined;const id=token();
    this.store.exec("INSERT INTO plans VALUES(?,?,?,?,'proposed',?,?,?,?)",id,uid,runId,(parent?.version??0)+1,run.snapshot_version,parentId??null,JSON.stringify(payload),iso());return this.plan(uid,id);
  }
  accept(uid:string,id:string,body:{expected_version:number;confirmation:true;idempotency_key:string}) {
    return this.store.atomic(()=> {
      const replay=this.store.one('SELECT * FROM plan_acceptances WHERE user_id=? AND key=?',uid,body.idempotency_key);
      if(replay) {if(replay.plan_id!==id||replay.expected_version!==body.expected_version) fail(409,'idempotency_conflict','Key already used');return JSON.parse(replay.result_json);}
      const plan=this.plan(uid,id);
      if(plan.status!=='proposed'||plan.version!==body.expected_version||plan.snapshot_version!==this.store.user(uid).snapshot_version) fail(409,'version_conflict','Plan changed or snapshot is stale');
      this.store.exec("UPDATE plans SET status='superseded' WHERE user_id=? AND status='accepted'",uid);
      const result=this.store.exec("UPDATE plans SET status='accepted',version=version+1 WHERE id=? AND user_id=? AND status='proposed' AND version=?",id,uid,body.expected_version);
      if(!result.changes) fail(409,'version_conflict','Plan already changed');
      const accepted=this.plan(uid,id);this.store.exec('INSERT INTO plan_acceptances VALUES(?,?,?,?,?)',uid,body.idempotency_key,id,body.expected_version,JSON.stringify(accepted));return accepted;
    });
  }
  demoEvent(uid:string,body:{kind:'surprise_expense'|'delayed_income';amount_cents?:number;days?:number;idempotency_key:string},enqueue:(intent:string,key:string)=>import('./db').Row) {
    return idempotent(this.store,uid,'demo_event',body.idempotency_key,body,()=> {
      const id=token();
      if(body.kind==='surprise_expense') {
        const account=found(this.store.accounts(uid).find(a=>a.kind==='checking'));
        this.store.exec('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,NULL)',id,uid,account.id,found(this.store.one("SELECT value FROM meta WHERE key='as_of'")).value,'Demo surprise expense','demo_expense',-body.amount_cents!);
        this.store.exec('UPDATE accounts SET balance_cents=balance_cents-? WHERE id=? AND user_id=?',body.amount_cents!,account.id,uid);
      }
      this.store.exec('INSERT INTO demo_events VALUES(?,?,?,?,?,?)',id,uid,body.kind,JSON.stringify(body),body.idempotency_key,iso());
      this.store.invalidate(uid);
      const run=enqueue('plan_repair',`repair:${id}`);
      return {id,run_id:run.id,snapshot_version:this.store.user(uid).snapshot_version,source_mode:'fixture',proposal_only:true};
    });
  }
}
