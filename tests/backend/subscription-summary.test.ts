import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures';
import {Simulator} from '../../src/server/simulator';
import {subscriptionSummary} from '../../src/server/subscription-summary';

test('recurring summary uses complete owned history and clears totals after disconnect',async()=>{
 const f=fixture(),sim=new Simulator(f.store);
 try {
  const empty=await subscriptionSummary(f.store,'demo-01');
  assert.equal(empty.summary.monthly_equivalent_cents,null);
  const login=f.credentials[0].institutions.find((c:{institution_id:string})=>f.store.one("SELECT id FROM accounts WHERE user_id=? AND institution_id=? AND kind='credit_card'",'demo-01',c.institution_id));
  const preview=sim.preview('demo-01',login.institution_id,login.username,login.password);
  const linked=sim.connect('demo-01',{preview_token:preview.preview_token,account_ids:preview.accounts.map(a=>a.id),consent_version:'v1',idempotency_key:'summary-scope'});
  const result=await subscriptionSummary(f.store,'demo-01');
  assert.ok(result.items.length);assert.ok(result.summary.monthly_equivalent_cents!>0);
  for(const row of result.items){assert.ok(row.recurrence!.charge_count>=3);assert.ok(row.recurrence!.history.every(t=>f.store.one('SELECT id FROM transactions WHERE id=? AND user_id=? AND account_id=?',t.transaction_id,'demo-01',row.account_id)));}
  assert.deepEqual((await subscriptionSummary(f.store,'demo-02')).items,[]);
  sim.revoke('demo-01',linked.id);
  const revoked=await subscriptionSummary(f.store,'demo-01');
  assert.deepEqual(revoked.items,[]);assert.equal(revoked.summary.annual_recurring_cents,null);
 }finally{f.close();}
});
