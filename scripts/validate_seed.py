import json,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def validate(path):
 db=sqlite3.connect(path)
 assert not db.execute('PRAGMA foreign_key_check').fetchall(),'Foreign key violation'
 assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 assert db.execute('SELECT count(*) FROM users').fetchone()[0]==10
 assert db.execute('SELECT count(*) FROM institution_logins').fetchone()[0]==30
 assert db.execute('SELECT count(*) FROM connections').fetchone()[0]==0
 assert db.execute('SELECT count(*) FROM accounts WHERE balance_cents != opening_cents+COALESCE((SELECT SUM(delta_cents) FROM transactions WHERE account_id=accounts.id),0)').fetchone()[0]==0
 assert db.execute("SELECT count(*) FROM accounts WHERE kind IN ('credit_card','auto_loan','mortgage') AND balance_cents<0").fetchone()[0]==0
 for uid, in db.execute('SELECT id FROM users'):
  n=db.execute("SELECT count(DISTINCT substr(posted_date,1,7)) FROM transactions WHERE user_id=?",(uid,)).fetchone()[0]
  assert n==30,(uid,n)
  assert db.execute('SELECT count(DISTINCT institution_id) FROM institution_logins WHERE user_id=?',(uid,)).fetchone()[0]==3
 assert db.execute('SELECT count(*) FROM (SELECT transfer_group FROM transactions WHERE transfer_group IS NOT NULL GROUP BY transfer_group HAVING count(*)!=2)').fetchone()[0]==0
 assert db.execute("SELECT count(*) FROM users WHERE email NOT LIKE '%@example.test'").fetchone()[0]==0
 result={'users':10,'institution_logins':30,'accounts':db.execute('SELECT count(*) FROM accounts').fetchone()[0],'transactions':db.execute('SELECT count(*) FROM transactions').fetchone()[0],'history_months_per_user':30,'reconciled':True,'connections_initially_unlinked':True}
 db.close();return result
if __name__=='__main__':print(json.dumps(validate(ROOT/'data/finpilot-demo.sqlite')))
