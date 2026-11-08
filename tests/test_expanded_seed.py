import importlib.util
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import seed_expanded_demo as seed

class ExpandedSeedTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory()
  cls.path=Path(cls.tmp.name)/'v2.sqlite'
  cls.manifest=seed.seed(cls.path)
  cls.db=sqlite3.connect(cls.path)
 @classmethod
 def tearDownClass(cls):
  cls.db.close();cls.tmp.cleanup()
 def test_5_to_8_institutions_with_owned_accounts(self):
  self.assertEqual(self.db.execute('SELECT count(*) FROM users').fetchone()[0],10)
  counts=[n for n, in self.db.execute('SELECT count(*) FROM institution_logins GROUP BY user_id')]
  self.assertEqual(sum(counts),63)
  self.assertTrue(all(5<=n<=8 for n in counts))
  self.assertEqual(self.db.execute('SELECT count(*) FROM institution_logins l WHERE NOT EXISTS(SELECT 1 FROM accounts a WHERE a.user_id=l.user_id AND a.institution_id=l.institution_id)').fetchone()[0],0)
 def test_reconciliation_and_no_impossible_balances(self):
  self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(),[])
  self.assertEqual(self.db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
  self.assertEqual(self.db.execute('SELECT count(*) FROM accounts WHERE balance_cents != opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0)').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT count(*) FROM accounts WHERE balance_cents<0 OR (credit_limit_cents IS NOT NULL AND balance_cents>credit_limit_cents)').fetchone()[0],0)
 def test_transfer_pair_signs_and_ownership(self):
  groups=self.db.execute('SELECT transfer_group,count(*),count(DISTINCT user_id) FROM transactions WHERE transfer_group IS NOT NULL GROUP BY transfer_group').fetchall()
  self.assertTrue(all(n==2 and users==1 for _,n,users in groups))
  for group,_,_ in groups:
   rows=self.db.execute('SELECT a.kind,t.delta_cents FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE transfer_group=?',(group,)).fetchall()
   self.assertEqual(sum(-delta if kind in seed.LIABILITIES else delta for kind,delta in rows),0,group)
 def test_history_variety_and_seed_boundary(self):
  for uid,n in self.manifest['history_months_per_user'].items():
   actual=self.db.execute('SELECT count(DISTINCT substr(posted_date,1,7)) FROM transactions WHERE user_id=?',(uid,)).fetchone()[0]
   self.assertEqual(actual,n)
  self.assertEqual(set(self.manifest['history_months_per_user'].values()),{12,15,18,21,24})
  self.assertEqual(self.db.execute('SELECT count(*) FROM connections').fetchone()[0],0)
  self.assertEqual(self.db.execute("SELECT value FROM meta WHERE key='requires_expanded_contract'").fetchone()[0],'true')
 def test_entity_ownership_and_restricted_business_cash(self):
  self.assertEqual(self.db.execute("SELECT count(*) FROM fixture_entities WHERE entity_type='business'").fetchone()[0],3)
  self.assertEqual(self.db.execute('SELECT count(*) FROM fixture_account_details d JOIN fixture_entities e ON e.id=d.entity_id WHERE d.user_id!=e.user_id').fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT count(*) FROM fixture_account_details WHERE restricted_cash=1').fetchone()[0],2)
  self.assertEqual(self.db.execute("SELECT count(*) FROM fixture_account_details d JOIN accounts a ON a.id=d.account_id WHERE a.kind IN ('business_loan','line_of_credit') AND d.entity_id NOT LIKE '%-business'").fetchone()[0],0)
 def test_invoice_payments_match_receipts_unpaid_not_cash(self):
  self.assertEqual(self.db.execute("SELECT count(*) FROM fixture_invoices i JOIN transactions t ON t.id=i.transaction_id WHERE i.status='paid' AND (t.user_id!=i.user_id OR t.account_id!=i.account_id OR t.delta_cents!=i.amount_cents OR t.posted_date!=i.paid_on OR t.category!='business_revenue')").fetchone()[0],0)
  self.assertEqual(self.db.execute("SELECT count(*) FROM fixture_invoices WHERE status!='paid' AND (transaction_id IS NOT NULL OR paid_on IS NOT NULL)").fetchone()[0],0)
  self.assertEqual(self.db.execute("SELECT count(*) FROM fixture_invoices WHERE status='overdue'").fetchone()[0],3)
 def test_business_metrics_derived_from_ledger(self):
  for uid,eid,month,revenue,cost,interest,service,draw,tax,tax_paid in self.db.execute('SELECT * FROM fixture_monthly_business_metrics'):
   rows=self.db.execute('SELECT t.category,t.delta_cents,t.transfer_group,a.kind FROM transactions t JOIN fixture_account_details d ON d.account_id=t.account_id JOIN accounts a ON a.id=t.account_id WHERE t.user_id=? AND d.entity_id=? AND substr(t.posted_date,1,7)=?',(uid,eid,month)).fetchall()
   self.assertEqual(revenue,sum(delta for cat,delta,group,kind in rows if cat=='business_revenue'))
   actual_cost=sum(-delta if kind not in seed.LIABILITIES else delta for cat,delta,group,kind in rows if cat in ('inventory','contractors','payroll','business_overhead'))
   self.assertEqual(cost,actual_cost)
   self.assertEqual(interest,sum(delta for cat,delta,group,kind in rows if cat=='interest' and kind in seed.LIABILITIES))
   self.assertEqual(service,-sum(delta for cat,delta,group,kind in rows if group and cat=='transfer' and kind in seed.LIABILITIES))
   self.assertEqual(tax_paid,-sum(delta for cat,delta,group,kind in rows if cat=='estimated_tax'))
 def test_demo_scores_are_explicit_fixtures(self):
  self.assertEqual(self.db.execute("SELECT count(*) FROM fixture_credit_profiles WHERE source_mode='fixture' AND model LIKE '%not FICO%' AND score BETWEEN 300 AND 850").fetchone()[0],10)
  self.assertEqual(self.db.execute('SELECT count(DISTINCT score) FROM fixture_credit_profiles').fetchone()[0],10)
 def test_safe_output_refusal(self):
  original=self.path.read_bytes()
  with self.assertRaises(SystemExit):seed.seed(self.path)
  self.assertEqual(self.path.read_bytes(),original)
  with self.assertRaises(SystemExit):seed.seed(self.path.parent/'other.sqlite')
  self.assertFalse((self.path.parent/'other.sqlite').exists())
 def test_matching_credentials_and_separate_hashes(self):
  from seed_demo import verify_password
  credentials=json.loads((self.path.parent/'demo-credentials.json').read_text())
  for c in credentials:
   ph=self.db.execute('SELECT password_hash FROM users WHERE id=?',(c['user_id'],)).fetchone()[0]
   self.assertTrue(verify_password(c['app_password'],ph))
   for ins in c['institutions']:
    ih=self.db.execute('SELECT password_hash FROM institution_logins WHERE user_id=? AND institution_id=?',(c['user_id'],ins['institution_id'])).fetchone()[0]
    self.assertTrue(verify_password(ins['password'],ih));self.assertNotEqual(ph,ih)
    self.assertEqual(ins['username'],c['email'])
    self.assertEqual(ins['verification_recipient'],c['email'])
    self.assertNotIn('otp',ins)

if __name__=='__main__':unittest.main()
