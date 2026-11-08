"""Read-only checks for the populated presentation dataset; prints no credentials."""
import argparse
import json
import sqlite3
from pathlib import Path
from seed_demo import PROFILES


def validate(path):
    database = Path(path).resolve(strict=True)
    db = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
    try:
        assert not db.execute('PRAGMA foreign_key_check').fetchall(), 'Invalid ownership reference'
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok', 'Database integrity failure'
        for index, (_, slug, *_) in enumerate(PROFILES):
            uid = f'demo-{index+1:02d}'
            assert db.execute('SELECT email FROM users WHERE id=?', (uid,)).fetchone() == (slug+'@mail.finpilot.test',), 'Unrecognized demo identity'
            kinds = {row[0] for row in db.execute('SELECT kind FROM accounts WHERE user_id=?', (uid,))}
            assert {'checking','savings','credit_card','brokerage','ira','cd'} <= kinds and kinds & {'auto_loan','mortgage'}, 'Incomplete account types'
            assert db.execute('SELECT COUNT(DISTINCT substr(posted_date,1,7)) FROM transactions WHERE user_id=?', (uid,)).fetchone()[0] >= 30, 'Incomplete history'
            assert db.execute("SELECT COUNT(*) FROM accounts a WHERE a.user_id=? AND NOT EXISTS (SELECT 1 FROM connection_accounts ca JOIN connections c ON c.id=ca.connection_id AND c.user_id=ca.user_id WHERE ca.user_id=a.user_id AND ca.account_id=a.id AND c.user_id=? AND c.status='active')", (uid,uid)).fetchone()[0] == 0, 'Account not preloaded'
        assert db.execute('SELECT COUNT(*) FROM accounts a WHERE balance_cents!=opening_cents+(SELECT COALESCE(SUM(delta_cents),0) FROM transactions t WHERE t.user_id=a.user_id AND t.account_id=a.id)').fetchone()[0] == 0, 'Unreconciled balance'
        return {'users':len(PROFILES),'accounts':db.execute('SELECT COUNT(*) FROM accounts').fetchone()[0], 'transactions':db.execute('SELECT COUNT(*) FROM transactions').fetchone()[0], 'seven_account_types_per_user':True,'reconciled':True}
    finally:
        db.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database', required=True)
    print(json.dumps(validate(parser.parse_args().database)))
