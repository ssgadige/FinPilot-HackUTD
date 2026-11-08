// CLI-only synthetic harness, not an application authentication/consent bypass.
import { DatabaseSync } from 'node:sqlite';
import type { ToolContext } from '../../contracts/types.ts';
import type { PlanningSnapshot } from '../../src/server/agents/planning/types.ts';
import { plusDays } from '../../src/server/agents/planning/math.ts';
import { reservedObligations } from '../../src/server/agents/planning/calculations.ts';
import { createTools } from '../../src/server/agents/runtime/tools.ts';
import { createPlanningTools } from '../../src/server/agents/planning/tools.ts';
import { createStressTools } from '../../src/server/agents/stress/tools.ts';
import type { SpecialistId } from '../../contracts/types.ts';
export function seedPersonas(path:string){
  type Profile={id:string;persona:string;snapshot_version:number};
  type Account={id:string;user_id:string;kind:string;opening_cents:number;balance_cents:number;credit_limit_cents:number|null;apr_bps:number|null;minimum_payment_cents:number|null};
  type Transaction={id:string;user_id:string;account_id:string;posted_date:string;delta_cents:number;transfer_group:string|null};
  type Scheduled={id:string;user_id:string;account_id:string;direction:string;amount_cents:number;day_of_month:number};
  const db=new DatabaseSync(path,{readOnly:true});
  if((db.prepare("SELECT value FROM meta WHERE key='source_mode'").get() as {value:string}|undefined)?.value!=='fixture'){db.close();throw new Error('SYNTHETIC_ONLY');}
  const profiles=db.prepare('SELECT id,persona,snapshot_version FROM users ORDER BY id').all() as Profile[];
  return {profiles,close:()=>db.close(),load(userId:string,runId:string,simulatedConsent:boolean){
    if(simulatedConsent!==true || !profiles.some(p=>p.id===userId))throw new Error('HARNESS_CONSENT');
    const user=db.prepare('SELECT id,snapshot_version FROM users WHERE id=?').get(userId) as Profile;
    const rows=db.prepare('SELECT id,user_id,kind,opening_cents,balance_cents,credit_limit_cents,apr_bps,minimum_payment_cents FROM accounts WHERE user_id=? ORDER BY id').all(userId) as Account[];
    const asOf=(db.prepare("SELECT value FROM meta WHERE key='as_of'").get() as {value:string}).value;
    const context:ToolContext={userId,runId,snapshotVersion:user.snapshot_version,allowedAccountIds:rows.map(a=>a.id)};
    const transactions=db.prepare('SELECT t.id,t.user_id,t.account_id,t.posted_date,t.delta_cents,t.transfer_group FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE t.user_id=? AND a.user_id=? ORDER BY t.posted_date,t.id').all(userId,userId) as Transaction[];
    const scheduled=db.prepare('SELECT id,user_id,account_id,direction,amount_cents,day_of_month FROM scheduled_items WHERE user_id=?').all(userId) as Scheduled[];
    const nextDate=(day:number)=>{for(let i=1;i<=30;i++){const d=plusDays(asOf,i);if(new Date(d).getUTCDate()===day)return d;}throw new Error('SCHEDULE_RANGE');};
    const legacy={userId,version:context.snapshotVersion,asOf,sourceMode:'fixture' as const,
      accounts:rows.map(a=>({id:a.id,userId,kind:a.kind,openingCents:a.opening_cents,balanceCents:a.balance_cents,connected:true,syncedAt:`${asOf}T00:00:00.000Z`})),
      transactions:transactions.map(t=>({id:t.id,userId:t.user_id,accountId:t.account_id,date:t.posted_date,deltaCents:t.delta_cents,transferGroup:t.transfer_group??undefined})),
      scheduled:scheduled.map(s=>({id:s.id,userId:s.user_id,accountId:s.account_id,date:nextDate(s.day_of_month),deltaCents:s.direction==='income'?s.amount_cents:-s.amount_cents}))};
    let active=true;
    const authorize=async(ctx:ToolContext)=>{
      if(!active || ctx.userId!==context.userId || ctx.snapshotVersion!==context.snapshotVersion || JSON.stringify([...ctx.allowedAccountIds].sort())!==JSON.stringify([...context.allowedAccountIds].sort()))throw new Error('HARNESS_OWNER');
      const accounts=db.prepare('SELECT id FROM accounts WHERE user_id=?').all(ctx.userId) as {id:string}[];
      if(ctx.allowedAccountIds.some(id=>!accounts.some(a=>a.id===id)))throw new Error('ACCOUNT_SCOPE');
    };
    return {context,legacy,authorize,revoke:()=>{active=false;},toolsFor:(role:SpecialistId)=>['data-integrity','cash-collision'].includes(role)?createTools(async ctx=>{await authorize(ctx as ToolContext);return structuredClone(legacy);}):null};
  }};
}
export function fixtureCapabilities(snapshot:PlanningSnapshot){
  const ctx:ToolContext={userId:snapshot.userId,runId:'fixture-integration',snapshotVersion:snapshot.version,allowedAccountIds:snapshot.accounts.map(a=>a.id)};
  const legacy={userId:snapshot.userId,version:snapshot.version,asOf:snapshot.asOf,sourceMode:snapshot.sourceMode,
    accounts:snapshot.accounts.map(a=>({id:a.id,userId:a.userId,connected:a.connected,kind:a.kind==='loan'?'auto_loan':a.kind,openingCents:a.balanceCents,balanceCents:a.balanceCents,syncedAt:`${snapshot.asOf}T00:00:00.000Z`})),transactions:[],
    scheduled:reservedObligations(snapshot).obligations.map((o,i)=>({id:`scheduled-${i}`,userId:snapshot.userId,accountId:o.accountId,date:o.date,deltaCents:-o.amountCents}))};
  return {context:ctx,toolsFor:(role:SpecialistId)=>{
    if(['data-integrity','cash-collision'].includes(role))return createTools(async()=>structuredClone(legacy));
    if(['debt-readiness','goal-allocator'].includes(role))return createPlanningTools(async()=>structuredClone(snapshot));
    if(role==='stress-test')return createStressTools(async()=>({planning:structuredClone(snapshot),incomes:[]}));
    return null;
  }};
}
