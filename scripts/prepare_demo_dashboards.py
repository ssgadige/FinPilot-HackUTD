"""Explicit, idempotent presentation provisioning of the ten installed demo users.

Does not seed, reset, change credentials, fabricate records, or change HTTP auth.
Existing account access is preserved; the operator explicitly selects all installed
demo accounts for the presentation. A consistent SQLite backup precedes --apply.
"""
import calendar
import argparse
import datetime
import json
import secrets
import sqlite3
from pathlib import Path
from seed_demo import PROFILES


def prepare(path, apply=False, expand=False):
    path = Path(path).resolve(strict=True)
    db = sqlite3.connect(path)
    db.execute('PRAGMA foreign_keys=ON')
    expected = {f'demo-{i+1:02d}': slug + '@mail.finpilot.test' for i, (_, slug, *_) in enumerate(PROFILES)}
    for uid, email in expected.items():
        if db.execute('SELECT email FROM users WHERE id=?', (uid,)).fetchone() != (email,):
            db.close()
            raise RuntimeError('Installed users do not match the recognized demo dataset')
    report = []
    for uid in expected:
        total = db.execute('SELECT COUNT(*) FROM accounts WHERE user_id=?', (uid,)).fetchone()[0]
        linked = db.execute("SELECT COUNT(DISTINCT ca.account_id) FROM connection_accounts ca JOIN connections c ON c.id=ca.connection_id AND c.user_id=ca.user_id JOIN accounts a ON a.id=ca.account_id AND a.user_id=ca.user_id WHERE c.user_id=? AND c.status='active'", (uid,)).fetchone()[0]
        kinds = {r[0] for r in db.execute('SELECT kind FROM accounts WHERE user_id=?', (uid,))}
        target = {'checking','savings','credit_card','brokerage','ira','cd', 'mortgage' if 'mortgage' in kinds else 'auto_loan'}
        missing_types = sorted(target-kinds) if expand else []
        report.append({'user': uid, 'accounts': total+len(missing_types), 'already_linked': linked, 'to_link': total-linked+len(missing_types), 'add_types': missing_types})
    if apply and any(r['to_link'] for r in report):
        backup = path.parent / 'backups' / ('before-dashboard-preparation-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
        backup.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(backup) as copy:
            db.backup(copy)
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with db:
            for row in report:
                uid = row['user']
                if row['add_types']:
                    index = int(uid[-2:])-1
                    income = PROFILES[index][3]
                    bank = db.execute("SELECT institution_id FROM accounts WHERE user_id=? AND kind='checking' ORDER BY id LIMIT 1", (uid,)).fetchone()[0]
                    savings = db.execute("SELECT id FROM accounts WHERE user_id=? AND kind='savings' ORDER BY id LIMIT 1", (uid,)).fetchone()[0]
                    start = db.execute("SELECT value FROM meta WHERE key='history_start'").fetchone()[0]
                    end = db.execute("SELECT value FROM meta WHERE key='history_end'").fetchone()[0]
                    year, month = map(int,start[:7].split('-'))
                    months=[]
                    while f'{year:04d}-{month:02d}-01' <= end:
                        months.append((year,month))
                        month += 1
                        if month==13: year,month=year+1,1
                    for offset,kind in enumerate(row['add_types']):
                        aid=f'{uid}-presentation-{kind}'
                        opening=600000 if kind=='auto_loan' else income*({'brokerage':8,'ira':12,'cd':3}[kind])
                        provider='demo-auto' if kind=='auto_loan' else bank
                        maturity=(datetime.date.fromisoformat(end)+datetime.timedelta(days=210)).isoformat() if kind=='cd' else None
                        db.execute('INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(aid,uid,provider,kind,{'brokerage':'Investment account','ira':'Retirement IRA','cd':'Certificate of deposit','auto_loan':'Auto loan'}[kind],str(7000+index*10+offset),opening,opening,None,650 if kind=='auto_loan' else 350,10000 if kind=='auto_loan' else None,maturity))
                        for number,(year,month) in enumerate(months):
                            date=f'{year:04d}-{month:02d}-28'
                            tid=f'{aid}-{number:02d}'
                            if kind=='auto_loan':
                                group=tid+'-payment'
                                db.execute('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)',(tid+'-out',uid,savings,date,'Auto loan payment','transfer',-10000,group))
                                db.execute('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,?)',(tid+'-in',uid,aid,date,'Auto loan payment','transfer',-10000,group))
                                delta,merchant,category=2500,'Loan interest','interest'
                            else:
                                delta=1000 if kind=='cd' else ((number*173+index*317)%8000)-1500
                                merchant,category=('Interest credit','interest') if kind=='cd' else ('Monthly valuation','valuation')
                            db.execute('INSERT INTO transactions VALUES(?,?,?,?,?,?,?,NULL)',(tid,uid,aid,date,merchant,category,delta))
                        db.execute('UPDATE accounts SET balance_cents=opening_cents+(SELECT COALESCE(SUM(delta_cents),0) FROM transactions WHERE user_id=? AND account_id=?) WHERE id=? AND user_id=?',(uid,aid,aid,uid))
                        if kind=='auto_loan':
                            db.execute('UPDATE accounts SET balance_cents=opening_cents+(SELECT COALESCE(SUM(delta_cents),0) FROM transactions WHERE user_id=? AND account_id=?) WHERE id=? AND user_id=?',(uid,savings,savings,uid))
                            db.execute('INSERT INTO scheduled_items VALUES(?,?,?,?,?,?,?,?)',(aid+'-due',uid,savings,'expense','Auto loan payment',10000,28,1))
                missing = db.execute("SELECT a.id,a.institution_id FROM accounts a WHERE a.user_id=? AND NOT EXISTS (SELECT 1 FROM connection_accounts ca JOIN connections c ON c.id=ca.connection_id AND c.user_id=ca.user_id WHERE ca.account_id=a.id AND ca.user_id=a.user_id AND c.user_id=? AND c.status='active')", (uid,uid)).fetchall()
                for iid in sorted({a[1] for a in missing}):
                    existing = db.execute("SELECT id FROM connections WHERE user_id=? AND institution_id=? AND status='active' ORDER BY id LIMIT 1", (uid,iid)).fetchone()
                    cid = existing[0] if existing else secrets.token_urlsafe(32)
                    if not existing:
                        db.execute("INSERT INTO connections VALUES(?,?,?,'active','demo-presentation-v1',?,?)", (cid,uid,iid,now,'presentation:'+cid))
                    for aid, provider in missing:
                        if provider == iid:
                            db.execute('INSERT INTO connection_accounts VALUES(?,?,?)', (cid,uid,aid))
                if missing:
                    db.execute('UPDATE users SET snapshot_version=snapshot_version+1 WHERE id=?', (uid,))
                    db.execute("UPDATE plans SET status='stale' WHERE user_id=? AND status='proposed'", (uid,))
        print('Consistent backup created before changes.')
    db.close()
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--expand-account-types', action='store_true')
    args = parser.parse_args()
    print(json.dumps({'applied': args.apply, 'users': prepare(args.database, args.apply, args.expand_account_types)}, indent=2))
