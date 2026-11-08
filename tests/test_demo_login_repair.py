import importlib.util
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from seed_demo import password_hash,verify_password,PROFILES
from repair_demo_logins import repair

class RepairTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'existing.sqlite'
  db=sqlite3.connect(self.path);db.executescript((ROOT/'data/schema.sql').read_text())
  db.execute("INSERT INTO meta VALUES('source_mode','fixture')")
  db.execute("INSERT INTO institutions VALUES('chase','Chase','banks',1)")
  self.hash=password_hash('OldRandomPassword!')
  for i,(name,slug,*_) in enumerate(PROFILES):
   uid=f'demo-{i+1:02d}'
   db.execute('INSERT INTO users(id,name,email,password_hash,persona) VALUES(?,?,?,?,?)',(uid,name,slug+'@example.test',self.hash,'fixture'))
   db.execute('INSERT INTO institution_logins VALUES(?,?,?,?,?)',(uid+'-chase',uid,'chase',slug+'.chase',self.hash))
   db.execute('INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(uid+'-a1',uid,'chase','checking','Demo','1234',10000,10000,None,None,None,None))
   db.execute("INSERT INTO connections VALUES(?,?,?,'active','v1','2026-11-08',?)",(uid+'-conn',uid,'chase',uid+'-key'))
   db.execute('INSERT INTO connection_accounts VALUES(?,?,?)',(uid+'-conn',uid,uid+'-a1'))
   db.execute('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)',(uid+'-tx',uid,uid+'-a1','2026-10-01','Demo','income',10,None))
   db.execute('INSERT INTO sessions VALUES(?,?,?,?,?)',(uid+'-session',uid,'2026-11-08','2026-11-08','2026-11-09'))
  db.commit();db.close()
 def tearDown(self):self.tmp.cleanup()
 def records(self,table):
  db=sqlite3.connect(self.path);result=db.execute('SELECT * FROM '+table).fetchall();db.close();return result
 def test_inspect_is_read_only(self):
  before=self.path.read_bytes();r=repair(self.path)
  self.assertEqual(r['users_needing_repair'],10);self.assertEqual(self.path.read_bytes(),before);self.assertIsNone(r['backup'])
 def test_apply_preserves_finances_and_connections_and_hashes_passwords(self):
  tables=['accounts','transactions','connections','connection_accounts','meta'];before={t:self.records(t) for t in tables}
  r=repair(self.path,True);self.assertTrue(Path(r['backup']).exists())
  old=sqlite3.connect(r['backup']);self.assertTrue(old.execute('SELECT email FROM users LIMIT 1').fetchone()[0].endswith('@example.test'));old.close()
  for t in tables:self.assertEqual(self.records(t),before[t])
  self.assertEqual(self.records('sessions'),[])
  for row in self.records('users'):self.assertTrue(row[2].endswith('@mail.finpilot.test'));self.assertTrue(verify_password('123',row[3]));self.assertFalse(verify_password('wrong',row[3]))
  for row in self.records('institution_logins'):self.assertTrue(row[3].endswith('@mail.finpilot.test'));self.assertTrue(verify_password('123',row[4]))
 def test_second_apply_is_noop(self):
  repair(self.path,True);before=self.path.read_bytes();r=repair(self.path,True)
  self.assertFalse(r['applied']);self.assertEqual(r['users_needing_repair'],0);self.assertEqual(self.path.read_bytes(),before)
 def test_unrecognized_identity_refuses_all_changes(self):
  db=sqlite3.connect(self.path);db.execute("UPDATE users SET email='real@example.com' WHERE id='demo-10'");db.commit();db.close();before=self.path.read_bytes()
  with self.assertRaises(ValueError):repair(self.path,True)
  self.assertEqual(self.path.read_bytes(),before)
 def test_non_fixture_refused(self):
  db=sqlite3.connect(self.path);db.execute("UPDATE meta SET value='live'");db.commit();db.close()
  with self.assertRaises(ValueError):repair(self.path,True)
 def test_missing_path_does_not_create_database(self):
  missing=self.path.parent/'wrong.sqlite'
  with self.assertRaises(ValueError):repair(missing,True)
  self.assertFalse(missing.exists())

if __name__=='__main__':unittest.main()
