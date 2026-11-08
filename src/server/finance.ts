import { Store, VISIBLE, LIABILITIES } from './db';
import { fail, found } from './errors';
import { forecast, cashFlow, utilization, addDays, type IncomeShift, type Scheduled } from './tools/finance';
import { iso, token } from './auth';
import type { AccountSummary } from '../../contracts/types';
export class Finance {
  constructor(readonly store: Store) {}
  asOf() { return found(this.store.one("SELECT value FROM meta WHERE key='as_of'")).value as string; }
  accounts(uid:string,institution?:string):AccountSummary[] {
    return this.store.accounts(uid).filter(a=>!institution||a.institution_id===institution).map(a=>{
      const lastSync=this.store.one("SELECT MAX(c.last_sync_at) AS at FROM connections c JOIN connection_accounts ca ON ca.connection_id=c.id AND ca.user_id=c.user_id WHERE c.user_id=? AND ca.account_id=? AND c.status='active'",uid,a.id)?.at;
      return {id:a.id,institution_id:a.institution_id,kind:a.kind,label:a.label.replace(/\s*[\u2022\u00b7]\s*Simulation$/i,''),last_four:a.last_four,balance_cents:a.balance_cents,source_mode:'fixture',...(a.kind==='cd'?{maturity_date:a.maturity_date??null}:{}),...(typeof lastSync==='string'?{last_sync_at:lastSync}:{})};
    });
  }
  transactions(uid:string,query: {account_id?:string;from?:string;to?:string;category?:string;q?:string;cursor?:string;limit:number}) {
    if(query.account_id) this.store.account(uid,query.account_id);
    const where=['t.user_id=?',VISIBLE];const args: (string|number)[]=[uid,uid];
    for(const [key,op,value] of [['account_id','=',query.account_id],['posted_date','>=',query.from],['posted_date','<=',query.to],['category','=',query.category]] as const) if(value) {where.push(`t.${key}${op}?`);args.push(value);}
    if(query.q) {where.push("instr(lower(t.merchant),lower(?))>0");args.push(query.q);}
    if(query.cursor) {
      let c: unknown;try{c=JSON.parse(Buffer.from(query.cursor,'base64url').toString());}catch{fail(400,'invalid_cursor','Invalid cursor');}
      if(!Array.isArray(c)||c.length!==2||c.some(x=>typeof x!=='string'||x.length>100)) fail(400,'invalid_cursor','Invalid cursor');
      where.push('(t.posted_date<? OR (t.posted_date=? AND t.id<?))');args.push(c[0],c[0],c[1]);
    }
    const items=this.store.all(`SELECT t.id,t.account_id,t.posted_date,t.merchant,t.category,t.delta_cents,t.transfer_group,a.kind,'fixture' AS source_mode FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE ${where.join(' AND ')} ORDER BY t.posted_date DESC,t.id DESC LIMIT ?`,...args,query.limit+1);
    const more=items.length>query.limit;items.splice(query.limit);const last=items.at(-1);
    const presented=items.map(t=>({...t,date:t.posted_date,description:t.merchant,amount_cents:t.delta_cents,status:'posted',classification:t.transfer_group||t.category==='transfer'?'transfer':LIABILITIES.has(t.kind)?(t.delta_cents<0?'payment':'charge'):(t.delta_cents>0?'income':'charge')}));
    return {items:presented,snapshot_version:this.store.user(uid).snapshot_version,source_mode:'fixture',as_of:this.asOf(),next_cursor:more&&last?Buffer.from(JSON.stringify([last.posted_date,last.id])).toString('base64url'):null};
  }
  forecast(uid:string,days:number,expense=0,delay=0,drop=0) {
    const cash=this.store.accounts(uid).filter(a=>['checking','savings'].includes(a.kind));
    const ids=new Set(cash.map(a=>a.id));
    const items=this.store.scoped('scheduled_items',uid).filter(s=>ids.has(s.account_id));
    const events=this.store.all("SELECT payload_json FROM demo_events WHERE user_id=? AND kind='delayed_income' ORDER BY rowid",uid).map(e=>JSON.parse(e.payload_json));
    const delays=events.filter(e=>!e.scheduled_item_id).map(e=>e.days as number);
    const shifts=events.filter(e=>items.some(i=>i.id===e.scheduled_item_id&&i.account_id===e.account_id)) as IncomeShift[];
    const result=forecast(cash.reduce((n,a)=>n+a.balance_cents,0),this.asOf(),days,items as (Scheduled & {id:string})[],expense,delay,drop,delays,shifts);
    const commitments=[];
    for(let n=1;n<=days;n++) {
      const date=addDays(this.asOf(),n);
      for(const item of items) if(item.direction==='expense'&&Number(date.slice(-2))===item.day_of_month) commitments.push({id:`${item.id}:${date}`,account_id:item.account_id,date,description:item.label||item.merchant||item.kind||'Scheduled commitment',amount_cents:item.direction==='income'?item.amount_cents:-item.amount_cents});
    }
    return {...result,balances:result.dated_balances,account_ids:cash.map(a=>a.id),events:commitments,source_mode:'fixture',low_cash_explanation:'Lowest modeled balance over the forecast horizon; checking and savings only. Monthly schedules are assumptions, not posted transactions.',snapshot_version:this.store.user(uid).snapshot_version,missing_data:cash.length?[]:['No linked liquid accounts'],as_of:this.asOf()};
  }
  overview(uid:string) {
    const accounts=this.store.accounts(uid);
    const liquid=accounts.filter(a=>['checking','savings'].includes(a.kind)).reduce((n,a)=>n+a.balance_cents,0);
    const debt=accounts.filter(a=>LIABILITIES.has(a.kind)).reduce((n,a)=>n+a.balance_cents,0);
    const net=accounts.reduce((n,a)=>n+(LIABILITIES.has(a.kind)?-a.balance_cents:a.balance_cents),0);
    const scheduled=this.store.scoped('scheduled_items',uid);
    const essential=scheduled.filter(s=>s.essential&&s.direction==='expense').reduce((n,s)=>n+s.amount_cents,0);
    // Aggregate the latest full fixture month, not the host wall clock month.
    const end=found(this.store.one("SELECT value FROM meta WHERE key='history_end'")).value;
    const start=end.slice(0,8)+'01';
    const rows=this.store.all(`SELECT a.kind,t.category,t.transfer_group,t.delta_cents FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id WHERE t.user_id=? AND ${VISIBLE} AND t.posted_date BETWEEN ? AND ?`,uid,uid,start,end);
    const flow=cashFlow(rows as Parameters<typeof cashFlow>[0]);
    const debtAccounts=accounts.filter(a=>LIABILITIES.has(a.kind));
    const debtPayments=rows.filter(r=>LIABILITIES.has(r.kind)&&r.category==='transfer'&&r.delta_cents<0).reduce((n,r)=>n-r.delta_cents,0);
    const debtRatio=debtAccounts.length&&flow.income_cents>0?Math.round(debtPayments*10000/flow.income_cents):null;
    const cards=accounts.filter(a=>a.kind==='credit_card');
    const knownLimits=cards.length>0&&cards.every(a=>a.credit_limit_cents>0);
    const creditUtilization=knownLimits?utilization(cards.reduce((n,a)=>n+Math.max(0,a.balance_cents),0),cards.reduce((n,a)=>n+a.credit_limit_cents,0)).utilization_bps:null;
    return {liquid_cash_cents:liquid,debt_cents:debt,net_worth_cents:net,investments_cents:accounts.filter(a=>['brokerage','ira','cd'].includes(a.kind)).reduce((n,a)=>n+a.balance_cents,0),...flow,indicators:[{key:'cash_buffer_months',unit:'months',numerator_cents:liquid,denominator_cents:essential,missing_inputs:essential>0?[]:['Essential monthly schedule'],value:essential>0?liquid/essential:null,source_mode:'fixture',explanation:'Linked liquid balances / scheduled essential monthly expenses; incomplete schedules may overstate buffer.'},{key:'savings_rate_bps',value:flow.savings_rate_bps,source_mode:'fixture',explanation:'Latest full fixture month; paired transfers excluded; refunds reduce spending.'},{key:'debt_payment_income_ratio_bps',numerator_cents:debtPayments,denominator_cents:flow.income_cents,missing_inputs:debtRatio===null?['Linked liability payments or income']:[],value:debtRatio,source_mode:'fixture',explanation:'Latest full fixture month: observed linked liability payments / linked income; missing debt accounts or income gives no ratio.'},{key:'card_utilization_bps',numerator_cents:knownLimits?cards.reduce((n,a)=>n+Math.max(0,a.balance_cents),0):null,denominator_cents:knownLimits?cards.reduce((n,a)=>n+a.credit_limit_cents,0):null,missing_inputs:knownLimits?[]:['Linked cards with known limits'],value:creditUtilization,source_mode:'fixture',explanation:'Linked credit-card owed balances / linked known credit limits; missing cards or limits gives no ratio.'}],upcoming_bills:scheduled.filter(s=>s.direction==='expense').map(s=>{let due=addDays(this.asOf(),1);for(let i=1;i<=31;i++){due=addDays(this.asOf(),i);if(Number(due.slice(-2))===s.day_of_month)break;}return {...s,date:due,description:s.label||s.merchant||'Scheduled payment'};}),snapshot_version:this.store.user(uid).snapshot_version,source_mode:'fixture',as_of:this.asOf(),missing_data:accounts.length?[]:['No accounts linked']};
  }
  debts(uid:string) { return this.store.accounts(uid).filter(a=>LIABILITIES.has(a.kind)).map(a=>({id:a.id,balance_cents:a.balance_cents,apr_bps:a.apr_bps,minimum_payment_cents:a.minimum_payment_cents,credit_limit_cents:a.credit_limit_cents,...utilization(Math.max(0,a.balance_cents),a.credit_limit_cents)})); }
  // Calculation evidence is persisted, scoped to an immutable run snapshot.
  persistCalculation(uid:string,result:{evidence_id:string},payload:unknown) {
    const snapshot=this.store.user(uid).snapshot_version;const run=token();
    this.store.exec("INSERT INTO runs VALUES(?,?,?,'completed',?,?,?,NULL)",run,uid,'calculation',snapshot,run,iso());
    const id=`${result.evidence_id}-${run}`;
    this.store.exec("INSERT INTO evidence VALUES(?,?,?,'calculation',?,'fixture',?,?)",id,uid,run,result.evidence_id,iso(),JSON.stringify(payload));
    return id;
  }
}
