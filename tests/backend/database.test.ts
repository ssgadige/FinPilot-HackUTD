import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/server/db';
import { fixture } from './fixtures';
test('FP-09: seed reconciles, transactions roll back, and account selection is user-scoped',()=>{
 const f=fixture(),db=f.store;
 try {
  assert.equal(db.one('SELECT COUNT(*) AS n FROM users')!.n,10);
  assert.equal(db.one("SELECT COUNT(DISTINCT substr(posted_date,1,7)) AS n FROM transactions")!.n,30);
  assert.equal(db.one('SELECT COUNT(*) AS n FROM accounts a WHERE balance_cents!=opening_cents+(SELECT COALESCE(SUM(delta_cents),0) FROM transactions t WHERE t.account_id=a.id AND t.user_id=a.user_id)')!.n,0);
  assert.deepEqual(db.accounts('demo-01'),[]);
  db.exec("INSERT INTO connections VALUES('scope','demo-01','chase','active','v1',NULL,'scope')");
  db.exec("INSERT INTO connection_accounts VALUES('scope','demo-01','demo-01-a1')");
  assert.deepEqual(db.accounts('demo-01').map(a=>a.id),['demo-01-a1']);assert.deepEqual(db.accounts('demo-02'),[]);
  assert.ok(db.scoped('transactions','demo-01').every(t=>t.account_id==='demo-01-a1'&&t.user_id==='demo-01'));
  assert.throws(()=>db.exec("INSERT INTO connection_accounts VALUES('scope','demo-01','demo-02-a1')"));
  const snapshot=db.user('demo-01').snapshot_version;
  assert.throws(()=>db.atomic(()=>{db.invalidate('demo-01');throw Error('rollback');}));assert.equal(db.user('demo-01').snapshot_version,snapshot);
  const second=new Store(f.dir+'/demo.sqlite');second.close();assert.equal(db.one('SELECT COUNT(*) AS n FROM backend_migrations')!.n,1);
  db.exec("UPDATE connections SET status='revoked' WHERE id='scope'");assert.deepEqual(db.scoped('transactions','demo-01'),[]);
 }finally{f.close();}
});
