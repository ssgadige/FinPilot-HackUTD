import type { Store } from './db';
import { fail, found } from './errors';

const scores=[684,721,758,596,746,638,792,776,709,652];
const slugs=['maya.chen','jordan.brooks','priya.shah','luis.rivera','amina.hassan','ethan.park','sofia.martinez','noah.williams','zoe.patel','oliver.reed'];
export const CREDIT_PROVIDER='finpilot-demo-monitor';
export class CreditMonitor {
  constructor(private store:Store) {
    store.db.exec(`CREATE TABLE IF NOT EXISTS credit_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),score INTEGER NOT NULL CHECK(score BETWEEN 300 AND 850),history_json TEXT NOT NULL,profile_json TEXT NOT NULL,observed_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS credit_monitor_connections(user_id TEXT PRIMARY KEY REFERENCES users(id),provider_id TEXT NOT NULL,connected_at TEXT NOT NULL);`);
    const observed=String(store.one("SELECT value FROM meta WHERE key='as_of'")?.value??'2026-11-07');
    scores.forEach((score,i)=>{
      const uid=`demo-${String(i+1).padStart(2,'0')}`;
      if(!store.one('SELECT id FROM users WHERE id=? AND email=?',uid,`${slugs[i]}@mail.finpilot.test`))return;
      const history=Array.from({length:12},(_,month)=>{const d=new Date(`${observed}T00:00:00Z`);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-11+month);return {month:d.toISOString().slice(0,7),score:month===11?score:Math.max(300,Math.min(850,score-(11-month)*(i===3?-2:2)+((month+i)%3-1)*3))};});
      store.exec('INSERT OR IGNORE INTO credit_profiles VALUES(?,?,?,?,?)',uid,score,JSON.stringify(history),JSON.stringify({payment_history:i===3?'Missed payments in demo history':'On-time payments in demo history',credit_history_months:[48,72,96,39,144,18,120,240,64,42][i],recent_inquiries:[2,1,0,4,1,3,0,0,2,2][i],factors:i===3?['High revolving balances','Recent missed payments']:i===5?['Short credit history','Recent credit inquiries']:['Established payment history','Review card balances before applying']}),observed);
    });
  }
  view(uid:string) {
    this.store.user(uid);
    const connection=this.store.one('SELECT provider_id,connected_at FROM credit_monitor_connections WHERE user_id=?',uid);
    const profile=this.store.one('SELECT * FROM credit_profiles WHERE user_id=?',uid);
    const cards=this.store.accounts(uid).filter(a=>a.kind==='credit_card');
    const limits=cards.length>0&&cards.every(a=>Number.isSafeInteger(a.credit_limit_cents)&&a.credit_limit_cents>0);
    const utilization_bps=limits?Math.round(cards.reduce((n,a)=>n+Math.max(0,a.balance_cents),0)*10000/cards.reduce((n,a)=>n+a.credit_limit_cents,0)):null;
    return {connected:!!connection,provider:{id:CREDIT_PROVIDER,name:'FinPilot Demo Credit Monitor',mode:'demo' as const},available:!!profile,connection:connection??null,
      profile:connection&&profile?{score:profile.score,min:300,max:850,model:'Demonstration score — not FICO or VantageScore',observed_at:profile.observed_at,history:JSON.parse(profile.history_json),...JSON.parse(profile.profile_json),utilization_bps}:null,
      source_mode:'fixture' as const,snapshot_version:this.store.user(uid).snapshot_version,
      approval:{status:'unknown',probability:null,explanation:'A score alone cannot establish approval or a loan amount. Lender criteria, verified income, existing debts and product terms are required.'}};
  }
  connect(uid:string,provider:string) {
    if(provider!==CREDIT_PROVIDER)fail(400,'unsupported_monitor','Choose the available demonstration monitor');
    found(this.store.one('SELECT user_id FROM credit_profiles WHERE user_id=?',uid));
    this.store.atomic(()=>{
      if(!this.store.one('SELECT user_id FROM credit_monitor_connections WHERE user_id=?',uid)) {
        this.store.exec('INSERT INTO credit_monitor_connections VALUES(?,?,?)',uid,provider,new Date().toISOString());this.store.invalidate(uid);
      }
    });return this.view(uid);
  }
  disconnect(uid:string) {this.store.atomic(()=>{const row=this.store.exec('DELETE FROM credit_monitor_connections WHERE user_id=?',uid);if(row.changes)this.store.invalidate(uid);});return this.view(uid);}
}
