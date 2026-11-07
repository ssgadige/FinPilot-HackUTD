import importlib.util,json,sqlite3,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
seed=module('seed','seed_demo.py');validation=module('validation','validate_seed.py')
class SeedTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();cls.path=Path(cls.tmp.name)/'demo.sqlite';seed.seed(cls.path)
 @classmethod
 def tearDownClass(cls):cls.tmp.cleanup()
 def test_complete_reconciled_history(self):self.assertTrue(validation.validate(self.path)['reconciled'])
 def test_password_separation_and_hash_verification(self):
  creds=json.loads((self.path.parent/'demo-credentials.json').read_text());db=sqlite3.connect(self.path)
  for c in creds:
   ph=db.execute('SELECT password_hash FROM users WHERE id=?',(c['user_id'],)).fetchone()[0]
   self.assertTrue(seed.verify_password(c['app_password'],ph));self.assertFalse(seed.verify_password('wrong',ph))
   for ins in c['institutions']:
    ih=db.execute('SELECT password_hash FROM institution_logins WHERE username=?',(ins['username'],)).fetchone()[0]
    self.assertTrue(seed.verify_password(ins['password'],ih));self.assertFalse(seed.verify_password(c['app_password'],ih))
  db.close()
 def test_refuses_accidental_overwrite(self):
  with self.assertRaises(SystemExit):seed.seed(self.path)
 def test_composite_account_ownership_constraint(self):
  db=sqlite3.connect(self.path);db.execute('PRAGMA foreign_keys=ON')
  with self.assertRaises(sqlite3.IntegrityError):db.execute("INSERT INTO transactions VALUES('attack','demo-01','demo-02-a1','2026-11-07','Test','shopping',1,NULL)")
  db.close()
 def test_different_spending_histories(self):
  db=sqlite3.connect(self.path);values=db.execute('SELECT SUM(ABS(delta_cents)) FROM transactions WHERE transfer_group IS NULL GROUP BY user_id').fetchall();self.assertEqual(len(set(values)),10);db.close()
if __name__=='__main__':unittest.main()
