import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Auth } from '../../src/server/auth';
import { Simulator } from '../../src/server/simulator';
import { Finance } from '../../src/server/finance';
import { createApi } from '../../src/server/api';
import { fixture } from './fixtures';
test('FP-12: scoped finance routes, 30-month filters, pagination, aggregates, evidence and disconnect',async()=>{
 const f=fixture(),db=f.store,sim=new Simulator(db),finance=new Finance(db);let code='';const auth=new Auth(db,{secret:'fixture-secret-'.repeat(4),appUrl:'http://localhost:3000',allowLocalHttp:true},{async send(_email,value){code=value;}});const handle=createApi({store:db,auth,simulator:sim,finance});
 try {
  const sessions:ReturnType<Auth['verify']>[]=[];for(const c of f.credentials.slice(0,2)){const pending=await auth.login(c.email,c.app_password,'fixture');sessions.push(auth.verify(pending.challenge_id,code,pending.pending));}
  const request=async(path:string,index=0,method='GET',body?:unknown)=>{const session=sessions[index];const response=await handle(new Request('http://localhost:3000/api/v1/'+path,{method,headers:{origin:'http://localhost:3000',cookie:'fp_session='+session.session,'x-csrf-token':session.csrf,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));return {status:response.status,data:response.status===204?null:await response.json()};};
  assert.equal((await request('overview',1)).data.indicators[0].value,null);
  const empty=await request('accounts',1);assert.equal(empty.status,200);assert.deepEqual(empty.data.items,[]);assert.equal(empty.data.snapshot_version,db.user('demo-02').snapshot_version);assert.equal(empty.data.source_mode,'fixture');
  assert.equal((await handle(new Request('http://localhost:3000/api/v1/accounts'))).status,401);
  const c=f.credentials[0].institutions[0],p=sim.preview('demo-01',c.institution_id,c.username,c.password);const linked=sim.connect('demo-01',{preview_token:p.preview_token,account_ids:[p.accounts[0].id],consent_version:'v1',idempotency_key:'finance-link'});
  const accounts=await request('accounts');assert.equal(accounts.status,200);assert.equal(accounts.data.items.length,1);assert.equal(accounts.data.snapshot_version,db.user('demo-01').snapshot_version);assert.notEqual(accounts.data.snapshot_version,empty.data.snapshot_version);assert.equal(accounts.data.as_of,finance.asOf());assert.ok(!JSON.stringify(accounts.data).includes('password'));assert.ok(!JSON.stringify(accounts.data).includes('opening_cents'));assert.equal(accounts.data.items[0].last_four.length,4);
  const first=await request('transactions?limit=2');const second=await request('transactions?limit=2&cursor='+encodeURIComponent(first.data.next_cursor));assert.equal(new Set([...first.data.items,...second.data.items].map(t=>t.id)).size,4);
  let cursor:string|null=null;const months=new Set<string>();let pages=0;do {assert.ok(pages++<40);const page=await request('transactions?limit=200'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(page.status,200);for(const t of page.data.items){assert.equal(t.account_id,p.accounts[0].id);months.add(t.posted_date.slice(0,7));}cursor=page.data.next_cursor;}while(cursor);assert.equal(months.size,30);assert.equal((await request('transactions?account_id=demo-02-a1')).status,404);assert.equal((await request('transactions?from=2026-02-30')).status,400);assert.equal((await request('transactions?limit=201')).status,400);assert.equal((await request('transactions?cursor=invalid')).status,400);
  const overview=await request('overview');assert.equal(overview.data.liquid_cash_cents,db.accounts('demo-01')[0].balance_cents);assert.equal(overview.data.net_worth_cents,overview.data.liquid_cash_cents);assert.equal(overview.data.source_mode,'fixture');
  const forecast=await request('forecast?days=30');assert.equal(forecast.status,200);assert.equal(forecast.data.dated_balances.length,31);const eid=forecast.data.evidence_ids[0];assert.equal((await request('evidence/'+eid)).status,200);assert.equal((await request('evidence/'+eid,1)).status,404);
  const calculation=await request('calculations',0,'POST',{kind:'loan',principal_cents:1000000,apr_bps:600,months:36,extra_payment_cents:0});assert.equal(calculation.status,201);assert.equal(calculation.data.payment_cents,30422);
  sim.revoke('demo-01',linked.id);const revoked=await request('accounts');assert.deepEqual(revoked.data.items,[]);assert.equal(revoked.data.snapshot_version,db.user('demo-01').snapshot_version);assert.ok(revoked.data.snapshot_version>accounts.data.snapshot_version);assert.equal((await request('evidence/'+eid)).status,404);assert.equal((await request('transactions?account_id='+p.accounts[0].id)).status,404);
 }finally{f.close();}
});
