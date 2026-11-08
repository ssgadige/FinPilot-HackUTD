import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fixture} from './fixtures';

test('presentation expansion preserves credentials and existing records, reconciles seven types for all ten users and is idempotent',()=>{
 const f=fixture();
 try {
  const credentials=JSON.stringify(f.store.all('SELECT id,password_hash FROM users ORDER BY id'));
  const logins=JSON.stringify(f.store.all('SELECT * FROM institution_logins ORDER BY id'));
  const originalTransactions=f.store.one('SELECT COUNT(*) AS n FROM transactions')!.n;
  const run=()=>execFileSync('python',['scripts/prepare_demo_dashboards.py','--database',join(f.dir,'demo.sqlite'),'--expand-account-types','--apply'],{stdio:'pipe'});
  run();
  assert.equal(f.store.one('SELECT COUNT(*) AS n FROM (SELECT user_id FROM accounts GROUP BY user_id HAVING COUNT(DISTINCT kind)=7)')!.n,10);
  assert.equal(f.store.one('SELECT COUNT(*) AS n FROM accounts a WHERE balance_cents!=opening_cents+(SELECT COALESCE(SUM(delta_cents),0) FROM transactions t WHERE t.user_id=a.user_id AND t.account_id=a.id)')!.n,0);
  assert.equal(f.store.all('PRAGMA foreign_key_check').length,0);
  assert.ok(JSON.stringify(f.store.all('SELECT id,password_hash FROM users ORDER BY id'))===credentials,'Existing credentials preserved');
  assert.ok(JSON.stringify(f.store.all('SELECT * FROM institution_logins ORDER BY id'))===logins,'Existing institution credentials preserved');
  const counts=JSON.stringify(f.store.all('SELECT user_id,COUNT(*) AS n FROM transactions GROUP BY user_id ORDER BY user_id'));
  assert.ok(f.store.one('SELECT COUNT(*) AS n FROM transactions')!.n>originalTransactions);
  for(let i=1;i<=10;i++){const uid=`demo-${String(i).padStart(2,'0')}`;assert.ok(f.store.accounts(uid).length>=7);assert.ok(f.store.accounts(uid).every(a=>a.user_id===uid));}
  run();assert.equal(JSON.stringify(f.store.all('SELECT user_id,COUNT(*) AS n FROM transactions GROUP BY user_id ORDER BY user_id')),counts);
 }finally{f.close();}
});
