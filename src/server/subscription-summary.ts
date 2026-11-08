import type { Store } from './db';
import { BackendAgentBridge } from './agents/integration/backend';
import { token } from './auth';

interface Candidate {
 subscription_id:string;candidate:boolean;billing_months:number|null;
 latest_charge_cents:number|null;monthly_equivalent_cents:number|null;
 price_increase_cents:number;charge_count:number;last_charge_date:string|null;
 history:{transaction_id:string;date:string;amount_cents:number}[];
}
/** Reuse the reviewed deterministic recurring detector; no inference or paginated totals. */
export async function subscriptionSummary(store:Store,uid:string) {
 const bridge=new BackendAgentBridge(store),context=bridge.contextFor(uid,token());
 const tools=bridge.toolsFor('subscription-detective')!;
 const signal=AbortSignal.timeout(10000);
 const [output,history]=await Promise.all([
  tools.detect_recurring.execute({scope:'snapshot'},context,signal),
  tools.get_merchant_history.execute({scope:'snapshot'},context,signal),
 ]);
 await bridge.authorize(context);
 const histories=(history.data as {histories:{subscription_id:string;charges:Candidate['history']}[]}).histories;
 const candidates=(output.data as {candidates:Candidate[]}).candidates.map(c=>({...c,history:histories.find(h=>h.subscription_id===c.subscription_id)?.charges??[]}));
 const complete=candidates.length>0&&candidates.every(c=>c.candidate&&c.monthly_equivalent_cents!==null&&c.latest_charge_cents!==null);
 const monthly=complete?candidates.reduce((n,c)=>n+c.monthly_equivalent_cents!,0):null;
 const annual=complete?candidates.reduce((n,c)=>n+c.latest_charge_cents!*(c.billing_months===12?1:12),0):null;
 return {items:store.scoped('subscriptions',uid).map(row=>({...row,id:row.id,account_id:row.account_id,recurrence:candidates.find(c=>c.subscription_id===row.id)??null})),
  summary:{monthly_equivalent_cents:monthly,annual_recurring_cents:annual,complete,assumptions:output.assumptions},
  snapshot_version:context.snapshotVersion,source_mode:'fixture',as_of:store.one("SELECT value FROM meta WHERE key='as_of'")?.value};
}
