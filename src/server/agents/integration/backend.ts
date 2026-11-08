// Server-only seam for the existing authenticated backend. The caller supplies a
// verified session UID; neither clients nor models construct this identity.
import type { Store } from '../../db/index.ts';
import type { ToolContext,SpecialistId } from '../../../../contracts/types.ts';
import { createTools } from '../runtime/tools.ts';
import { createSubscriptionTools } from '../subscription-tools.ts';
import { plusDays } from '../planning/math.ts';
import type { SubscriptionSnapshot } from '../subscription-tools.ts';
export class BackendAgentBridge {
  constructor(private store:Pick<Store,'user'|'accounts'|'scoped'|'all'|'one'>){}
  contextFor(verifiedUserId:string,runId:string):ToolContext {
    const user=this.store.user(verifiedUserId);
    return {userId:verifiedUserId,runId,snapshotVersion:user.snapshot_version,allowedAccountIds:this.store.accounts(verifiedUserId).map(a=>a.id)};
  }
  async authorize(ctx:ToolContext){
    const user=this.store.user(ctx.userId);const accounts=this.store.accounts(ctx.userId);
    if(user.snapshot_version!==ctx.snapshotVersion || ctx.allowedAccountIds.some(id=>!accounts.some(a=>a.id===id)))throw new Error('SNAPSHOT_SCOPE');
  }
  private asOf(){const value=this.store.one("SELECT value FROM meta WHERE key='as_of'")?.value;if(typeof value!=='string')throw new Error('INVALID_SNAPSHOT');return value;}
  private rows(ctx:ToolContext){return this.store.accounts(ctx.userId).filter(a=>ctx.allowedAccountIds.includes(a.id));}
  private nextDate(day:number){for(let i=1;i<=30;i++){const date=plusDays(this.asOf(),i);if(new Date(date).getUTCDate()===day)return date;}throw new Error('INVALID_SNAPSHOT');}
  async legacy(ctx:ToolContext){
    await this.authorize(ctx);const ids=new Set(ctx.allowedAccountIds);
    const source=this.store.one("SELECT value FROM meta WHERE key='source_mode'")?.value;if(source!=='fixture')throw new Error('UNSUPPORTED_FINANCIAL_SOURCE');
    const accounts=this.rows(ctx).map(a=>({id:a.id,userId:a.user_id,kind:a.kind,openingCents:a.opening_cents,balanceCents:a.balance_cents,connected:true,
      syncedAt:this.store.one("SELECT MAX(c.last_sync_at) AS at FROM connections c JOIN connection_accounts ca ON ca.connection_id=c.id AND ca.user_id=c.user_id WHERE c.user_id=? AND ca.user_id=? AND ca.account_id=? AND c.status='active'",ctx.userId,ctx.userId,a.id)?.at??`${this.asOf()}T00:00:00.000Z`}));
    const shifts=this.store.all("SELECT payload_json FROM demo_events WHERE user_id=? AND kind='delayed_income' ORDER BY rowid",ctx.userId).map(e=>JSON.parse(e.payload_json));
    return {userId:ctx.userId,version:ctx.snapshotVersion,asOf:this.asOf(),sourceMode:'fixture' as const,accounts,
      transactions:this.store.scoped('transactions',ctx.userId).filter(t=>ids.has(t.account_id)).map(t=>({id:t.id,userId:t.user_id,accountId:t.account_id,date:t.posted_date,deltaCents:t.delta_cents,transferGroup:t.transfer_group??undefined})),
      scheduled:this.store.scoped('scheduled_items',ctx.userId).filter(t=>ids.has(t.account_id)).map(t=>{
        let date=this.nextDate(t.day_of_month);
        if(t.direction==='income')for(const shift of shifts)if(shift.scheduled_item_id===t.id&&shift.account_id===t.account_id&&shift.original_date===date)date=shift.delayed_date;
        return {id:t.id,userId:t.user_id,accountId:t.account_id,date,deltaCents:t.direction==='income'?t.amount_cents:-t.amount_cents};
      })};
  }
  async subscriptions(ctx:ToolContext):Promise<SubscriptionSnapshot>{
    await this.authorize(ctx);const ids=new Set(ctx.allowedAccountIds);const legacy=await this.legacy(ctx);
    // Non-billing investment/loan accounts stay in the scope boundary; their
    // records cannot become recurring charge candidates.
    const rows=this.store.scoped('subscriptions',ctx.userId).filter(s=>ids.has(s.account_id));
    const subscriptions=rows.map(s=>{
      const p=JSON.parse(s.preferences_json);let features:unknown=[];try{features=JSON.parse(p.required_features??'[]');}catch{features=[];}
      return {id:s.id,userId:s.user_id,accountId:s.account_id,merchant:s.merchant,category:p.category==='music'?'music' as const:'other' as const,
        preferences:{confirmed:s.status==='confirmed',usage:['used','unused'].includes(s.usage_confirmed)?s.usage_confirmed:'unknown',country:p.country==='US'?'US' as const:null,
          required_features:Array.isArray(features)&&features.every(f=>typeof f==='string')?features:[],accounts:/^[1-6]$/.test(String(p.accounts))?Number(p.accounts):null,
          new_customer:typeof p.new_customer==='boolean'?p.new_customer:null,keep_service:typeof p.keep_service==='boolean'?p.keep_service:null,
          upfront_budget_cents:/^\d{1,9}$/.test(String(p.upfront_budget_cents))?Number(p.upfront_budget_cents):null}};
    });
    return {userId:ctx.userId,version:ctx.snapshotVersion,asOf:this.asOf(),sourceMode:'fixture',accounts:legacy.accounts.map(a=>({id:a.id,userId:a.userId,connected:true,kind:a.kind})),
      transactions:this.store.scoped('transactions',ctx.userId).filter(t=>ids.has(t.account_id)).map(t=>({id:t.id,userId:t.user_id,accountId:t.account_id,merchant:t.merchant,date:t.posted_date,deltaCents:t.delta_cents,transferGroup:t.transfer_group??undefined})),subscriptions};
  }
  toolsFor(role:SpecialistId){
    if(['data-integrity','cash-collision'].includes(role))return createTools((ctx)=>this.legacy(ctx as ToolContext));
    if(['subscription-detective','deal-scout'].includes(role))return createSubscriptionTools((ctx)=>this.subscriptions(ctx as ToolContext));
    // The existing goal schema does not identify each goal's funding account or
    // each debt's paying account/date. Never invent those mappings to advertise
    // readiness. FP-20/21 tools remain available with explicit server snapshots.
    return null;
  }
}
