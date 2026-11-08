import { Store } from './db';
import { Finance } from './finance';
import { Planning, planPayload, type PlanPayload, type OfferResolver } from './planning';
import { complete, readConfig, type Config } from './nemotron/index';
import { runAgent, RunBudget } from './agents/runtime/index';
import { createTools, type BoundTool, type Context, type Snapshot, type ToolOutput, type Role } from './agents/runtime/tools';
import { createSubscriptionTools, type SubscriptionSnapshot } from './agents/subscription-tools';
import { configuredFetchOffers } from './offers/source';
import { calculation, addDays } from './tools/finance';
import { fail, found } from './errors';
import type { Runner, RunControl, RunOutput } from './runs';
import type { ToolContext, AgentResult } from '../../contracts/types';
import { createHash } from 'node:crypto';
const liquidKinds=new Set(['checking','savings','credit_card']);
export class DatabaseOffers implements OfferResolver {
  constructor(readonly store:Store) {}
  async list(uid:string,id:string,signal:AbortSignal) {
    const get=()=>found(this.store.scoped('subscriptions',uid).find(s=>s.id===id));const sub=get();
    if(!/music|spotify/i.test(sub.merchant))return {items:[],source_mode:'fixture',availability:'unavailable'};
    const snapshot=this.store.user(uid).snapshot_version,result=await configuredFetchOffers(signal);
    get();if(snapshot!==this.store.user(uid).snapshot_version)fail(409,'stale_snapshot','Preferences changed');
    return {...result,items:result.offers.map(source=>source.offer)};
  }
}
export class DatabaseSnapshots {
  constructor(readonly store:Store,readonly finance:Finance) {}
  accounts(ctx:Context,signal:AbortSignal) {
    signal.throwIfAborted();const run=found(this.store.one('SELECT snapshot_version,status FROM runs WHERE id=? AND user_id=?',ctx.runId,ctx.userId));
    if(run.status!=='running'||run.snapshot_version!==ctx.snapshotVersion||this.store.user(ctx.userId).snapshot_version!==ctx.snapshotVersion)fail(409,'stale_snapshot','Snapshot changed');
    const selected=this.store.accounts(ctx.userId);
    if(ctx.allowedAccountIds.some(id=>!selected.some(a=>a.id===id)))fail(404,'not_found','Account access revoked');
    return selected.filter(a=>ctx.allowedAccountIds.includes(a.id));
  }
  async financial(ctx:Context,signal:AbortSignal):Promise<Snapshot> {
    const accounts=this.accounts(ctx,signal),ids=new Set(accounts.map(a=>a.id)),asOf=this.finance.asOf();
    const schedules=this.store.scoped('scheduled_items',ctx.userId).filter(s=>ids.has(s.account_id));
    const delays=this.store.all("SELECT payload_json FROM demo_events WHERE user_id=? AND kind='delayed_income' ORDER BY rowid",ctx.userId).map(e=>JSON.parse(e.payload_json).days as number);
    let incomeIndex=0;const scheduled:Snapshot['scheduled']=[];
    for(let n=1;n<=90;n++) {
      const due=addDays(asOf,n);
      for(const s of schedules)if(Number(due.slice(-2))===s.day_of_month)scheduled.push({id:s.id+':'+due,userId:ctx.userId,accountId:s.account_id,date:s.direction==='income'?addDays(due,delays[incomeIndex++]??0):due,deltaCents:s.direction==='income'?s.amount_cents:-s.amount_cents});
    }
    return {userId:ctx.userId,version:ctx.snapshotVersion,asOf,sourceMode:'fixture',accounts:accounts.map(a=>({id:a.id,userId:ctx.userId,connected:true,kind:a.kind,openingCents:a.opening_cents,balanceCents:a.balance_cents,syncedAt:found(this.store.one("SELECT MAX(c.last_sync_at) AS at FROM connections c JOIN connection_accounts ca ON ca.connection_id=c.id AND ca.user_id=c.user_id WHERE c.user_id=? AND ca.account_id=? AND c.status='active'",ctx.userId,a.id)).at})),
      transactions:this.store.scoped('transactions',ctx.userId).filter(t=>ids.has(t.account_id)).map(t=>({id:t.id,userId:ctx.userId,accountId:t.account_id,date:t.posted_date,deltaCents:t.delta_cents,...(t.transfer_group?{transferGroup:t.transfer_group}:{})})),scheduled};
  }
  async subscriptions(ctx:Context,signal:AbortSignal):Promise<SubscriptionSnapshot> {
    const accounts=this.accounts(ctx,signal),ids=new Set(accounts.map(a=>a.id));
    return {userId:ctx.userId,version:ctx.snapshotVersion,asOf:this.finance.asOf(),sourceMode:'fixture',accounts:accounts.map(a=>({id:a.id,userId:ctx.userId,connected:true,kind:a.kind})),
      transactions:this.store.scoped('transactions',ctx.userId).filter(t=>ids.has(t.account_id)).map(t=>({id:t.id,userId:ctx.userId,accountId:t.account_id,merchant:t.merchant,date:t.posted_date,deltaCents:t.delta_cents,...(t.transfer_group?{transferGroup:t.transfer_group}:{})})),
      subscriptions:this.store.scoped('subscriptions',ctx.userId).filter(s=>ids.has(s.account_id)).map(s=>{
        const p=JSON.parse(s.preferences_json),number=(key:string,max:number)=>typeof p[key]==='string'&&/^\d+$/.test(p[key])&&Number(p[key])<=max?Number(p[key]):null;
        return {id:s.id,userId:ctx.userId,accountId:s.account_id,merchant:s.merchant,category:/spotify|music/i.test(s.merchant)?'music':'other',preferences:{confirmed:s.status==='confirmed',usage:s.usage_confirmed??'unknown',country:p.country==='US'?'US':null,accounts:number('accounts',6),new_customer:typeof p.new_customer==='boolean'?p.new_customer:null,keep_service:typeof p.keep_service==='boolean'?p.keep_service:null,required_features:typeof p.required_features==='string'?p.required_features.split(',').map((v:string)=>v.trim()).filter(Boolean):[],upfront_budget_cents:number('upfront_budget_cents',100_000_000)}};
      })};
  }
}
export interface RuntimeConfiguration {infer?:typeof complete;config?:()=>Config;}
export class NemotronRunner implements Runner {
  constructor(readonly store:Store,readonly finance:Finance,readonly planning:Planning,readonly options:RuntimeConfiguration={}) {}
  async run(intent:string,context:Readonly<ToolContext>,control:RunControl):Promise<RunOutput> {
    const config=(this.options.config??readConfig)(),budget=new RunBudget(),snapshots=new DatabaseSnapshots(this.store,this.finance);
    const results:AgentResult[]=[],outputs=new Map<string,Awaited<ReturnType<typeof runAgent>>>();let candidate:PlanPayload|undefined,parentId:string|undefined;
    const tools={...createTools((ctx,signal)=>snapshots.financial(ctx,signal)),...createSubscriptionTools((ctx,signal)=>snapshots.subscriptions(ctx,signal))};
    const offered=['data-integrity','cash-collision','subscription-detective','deal-scout','plan-repair'];
    const defaults=intent.startsWith('plan_repair')?['data-integrity','cash-collision','plan-repair']:intent.startsWith('subscriptions')?['subscription-detective','deal-scout']:['data-integrity','cash-collision','subscription-detective','deal-scout'];
    const finance=this.finance;
    const meta=(name:string,read:(ctx:Context)=>unknown):BoundTool=>({schema:{type:'function',function:{name,description:name+': authorized deterministic analysis; use scope=snapshot; identity is server controlled.',parameters:{type:'object',properties:{scope:{type:'string',enum:['snapshot']}},required:['scope'],additionalProperties:false}}},async execute(args,ctx,signal):Promise<ToolOutput>{
      snapshots.accounts(ctx,signal);if(args.scope!=='snapshot'||Object.keys(args).length!==1)fail(400,'invalid_tool','Invalid tool arguments');
      const data=read(ctx),id='calc-'+createHash('sha256').update(JSON.stringify([ctx.runId,ctx.snapshotVersion,name,data])).digest('hex').slice(0,24);
      return {data,evidence:[{id,kind:'calculation',source_id:name,source_mode:'fixture',observed_at:finance.asOf()+'T00:00:00.000Z'}],assumptions:['Deterministic server data; fixture finances; proposals require confirmation.'],...(name==='get_plan_version'&&!parentId?{needsInformation:true}:{})};
    }});
    tools.route_specialists=meta('route_specialists',()=>({intent:intent.split(':')[0],available_specialists:offered,recommended:defaults,unavailable_specialists:['debt-readiness','goal-allocator','stress-test']}));
    tools.read_run_findings=meta('read_run_findings',()=>({results:results.filter(r=>r.agent_id!=='coordinator'),financial_source_mode:'fixture'}));
    tools.compare_plans=meta('compare_plans',()=>{
      if(!candidate&&!intent.startsWith('plan_repair')&&!intent.startsWith('debt')&&!intent.startsWith('goals')) {
        const existing=parent(),overview=this.finance.overview(context.userId),forecast=this.finance.forecast(context.userId,90);
        const reserve=existing?planPayload.parse(JSON.parse(existing.payload_json)).reserve_cents:overview.upcoming_bills.filter(b=>b.essential).reduce((sum,b)=>sum+b.amount_cents,0);
        let capacity=Math.max(0,Math.min(Math.floor((forecast.low_cash_cents-reserve)/3),overview.income_cents-overview.spending_cents));
        const asOf=this.finance.asOf();
        const allocations=this.store.all('SELECT id,target_cents,saved_cents,deadline FROM goals WHERE user_id=? ORDER BY priority,id',context.userId).map(goal=>{
          const months=Math.max(1,(Number(goal.deadline.slice(0,4))-Number(asOf.slice(0,4)))*12+Number(goal.deadline.slice(5,7))-Number(asOf.slice(5,7)));
          const monthly_cents=Math.min(capacity,Math.max(0,Math.ceil((goal.target_cents-goal.saved_cents)/months)));capacity-=monthly_cents;
          return {kind:'goal_contribution' as const,target_id:goal.id,monthly_cents,day_of_month:28};
        });
        candidate={allocations,reserve_cents:reserve,evidence_ids:[],assumptions:['Conservative server candidate: goal priority order, observed monthly surplus, essential-bill reserve and a 90-day cash bound. Subscription intentions contribute zero realized savings. No money is moved.']};
      }
      return {candidate:candidate??null,prior_plan_id:parentId??null,proposal_only:true,realized_savings_cents:0};
    });
    const parent=()=>{
      const p=this.store.one("SELECT id FROM plans WHERE user_id=? AND status='accepted'",context.userId);parentId=p?.id;
      return p?this.planning.plan(context.userId,p.id):undefined;
    };
    tools.get_plan_version=meta('get_plan_version',()=>{
      const p=parent();if(!p)return {accepted_plan:null,missing_data:['No accepted plan exists to revise']};
      const parsed=planPayload.parse(JSON.parse(p.payload_json));
      // Revalidate target ownership without exposing stale historical evidence to the model.
      this.planning.validatePayload(context.userId,{...parsed,evidence_ids:[]});
      return {id:p.id,version:p.version,stale:p.snapshot_version!==context.snapshotVersion,allocations:parsed.allocations,reserve_cents:parsed.reserve_cents};
    });
    tools.get_changed_events=meta('get_changed_events',()=>({events:this.store.all('SELECT id,kind,payload_json FROM demo_events WHERE user_id=? ORDER BY rowid DESC LIMIT 30',context.userId).map(e=>{const p=JSON.parse(e.payload_json);return {id:e.id,kind:e.kind,amount_cents:p.amount_cents??null,days:p.days??null};})}));
    tools.propose_plan_revision=meta('propose_plan_revision',()=>{
      const p=parent();if(!p)return {candidate:null,missing_data:['Accept a plan before requesting a revision'],proposal_only:true};
      const old=planPayload.parse(JSON.parse(p.payload_json)),forecast=this.finance.forecast(context.userId,90),flow=this.finance.overview(context.userId);
      const occurrences=Math.max(1,...old.allocations.map(a=>forecast.dated_balances.slice(1).filter(row=>Number(row.date.slice(-2))===a.day_of_month).length));
      let capacity=Math.max(0,Math.min(Math.floor((forecast.low_cash_cents-old.reserve_cents)/occurrences),flow.income_cents-flow.spending_cents));
      const allocations=old.allocations.map(a=>{const monthly_cents=Math.min(a.monthly_cents,capacity);capacity-=monthly_cents;return {...a,monthly_cents};});
      candidate={...old,allocations,evidence_ids:[],assumptions:[...old.assumptions.slice(0,25),'Revision caps allocations to observed monthly surplus and 90-day cash above reserve divided by the maximum allocation due-date count; planned subscription savings are excluded.']};
      this.planning.validatePayload(context.userId,candidate);
      return {candidate,parent_plan_id:p.id,prior_allocations:old.allocations,available_monthly_cents:allocations.reduce((sum,a)=>sum+a.monthly_cents,0),proposal_only:true,realized_savings_cents:0};
    });
    const roleContext=(agent:Role):ToolContext=>({...context,allowedAccountIds:agent==='subscription-detective'||agent==='deal-scout'?this.store.accounts(context.userId).filter(a=>context.allowedAccountIds.includes(a.id)&&liquidKinds.has(a.kind)).map(a=>a.id):[...context.allowedAccountIds]});
    const run=async(agent:Role,phase?:'route'|'merge')=>{
      const scoped=roleContext(agent),registry:Record<string,BoundTool>={};
      for(const [name,tool] of Object.entries(tools))registry[name]={schema:tool.schema,execute:async(args,ctx,signal)=>{
        control.beforeCall('tool',agent);const output=await tool.execute(args,ctx,signal);snapshots.accounts(ctx,signal);
        this.store.atomic(()=>{for(const evidence of output.evidence){const existing=this.store.one('SELECT user_id,run_id FROM evidence WHERE id=?',evidence.id);if(existing&&(existing.user_id!==ctx.userId||existing.run_id!==ctx.runId))fail(502,'invalid_evidence','Evidence ownership mismatch');if(!existing)this.store.exec('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)',evidence.id,ctx.userId,ctx.runId,evidence.kind,evidence.source_id,evidence.source_mode,evidence.observed_at,JSON.stringify(output.data));}});
        return output;
      }};
      const dependency=agent==='cash-collision'?outputs.get('data-integrity'):agent==='deal-scout'?outputs.get('subscription-detective'):undefined;
      const output=await runAgent({role:agent,context:scoped,config,tools:registry,budget,signal:control.signal,coordinatorPhase:phase,
        ...(dependency?{dependency:{result:dependency.result,evidence:dependency.evidence,context:roleContext(agent==='cash-collision'?'data-integrity':'subscription-detective')}}:{}),
        infer:async(...args)=>{control.beforeCall('model',agent);return (this.options.infer??complete)(...args);},
        onEvent:event=>control.event(agent,event.type==='queued'?'started':event.type,event.message),
      });
      if(output.result.status==='failed')fail(502,'runtime_failed','Nemotron role failed validation');
      control.step(output.result);outputs.set(agent,output);
      if(agent!=='coordinator'||phase==='merge')results.push(output.result);return output;
    };
    const route=await run('coordinator','route'),selected=new Set(route.result.selected_specialists??[]);
    if(intent.startsWith('plan_repair'))for(const role of defaults)selected.add(role as 'data-integrity');
    if(intent.startsWith('debt'))selected.add('debt-readiness');
    if(intent.startsWith('goals'))selected.add('goal-allocator');
    if(selected.has('cash-collision'))selected.add('data-integrity');if(selected.has('deal-scout'))selected.add('subscription-detective');
    const sequence=['data-integrity','cash-collision','subscription-detective','deal-scout','plan-repair'] as const;
    for(const agent of sequence)if(selected.has(agent))await run(agent);
    for(const agent of selected)if(!offered.includes(agent)) {
      const skipped:AgentResult={agent_id:agent,status:'skipped',headline:'Specialist integration unavailable',findings:[],evidence_ids:[],assumptions:[],missing_data:['This specialist is not installed; no analysis was performed.'],proposed_actions:[],snapshot_version:context.snapshotVersion};control.step(skipped);results.push(skipped);
    }
    await run('coordinator','merge');
    const repair=outputs.get('plan-repair');
    const final=outputs.get('coordinator')!;
    return {results,...(candidate&&(!intent.startsWith('plan_repair')||repair?.result.status==='completed')?{proposal:{payload:{...candidate,evidence_ids:intent.startsWith('plan_repair')?repair!.result.evidence_ids:final.result.evidence_ids},...(parentId?{parentId}:{})}}:{})};
  }
}
