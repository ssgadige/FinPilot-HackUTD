"""Repair only recognized synthetic identities in an existing fixture database.
Default is read-only inspection. --apply takes a SQLite backup, updates credentials
atomically, and revokes sessions/challenges only for changed demo users.
Financial records, connections and secrets are never reset.
"""
import argparse
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from seed_demo import PROFILES, password_hash, verify_password


def inspect(db):
 if db.execute("SELECT value FROM meta WHERE key='source_mode'").fetchone() != ('fixture',):
  raise ValueError('Refusing repair: database is not explicitly labeled fixture.')
 changes=[]
 for i,(name,slug,*_) in enumerate(PROFILES):
  uid=f'demo-{i+1:02d}';email=slug+'@mail.finpilot.test'
  row=db.execute('SELECT name,email,password_hash FROM users WHERE id=?',(uid,)).fetchone()
  if not row or row[0]!=name or row[1] not in (slug+'@example.test',email):
   raise ValueError(f'Refusing repair: {uid} is missing or does not match the known synthetic identity.')
  collision=db.execute('SELECT id FROM users WHERE email=? AND id!=?',(email,uid)).fetchone()
  if collision:raise ValueError(f'Refusing repair: destination email conflict for {uid}.')
  app_needs=row[1]!=email or not verify_password('123',row[2])
  institutions=[]
  for lid,iid,username,encoded in db.execute('SELECT id,institution_id,username,password_hash FROM institution_logins WHERE user_id=?',(uid,)):
   if username not in (email,slug+'@example.test',slug+'.'+iid):
    raise ValueError(f'Refusing repair: unexpected simulator username for {uid}/{iid}.')
   if username!=email or not verify_password('123',encoded):institutions.append((lid,iid))
  changes.append({'id':uid,'email':email,'app_change':app_needs,'institution_changes':institutions})
 return changes


def repair(database,apply=False):
 path=Path(database).resolve()
 if not path.is_file():raise ValueError('Database does not exist. Locate the running app database; do not create a new one.')
 db=sqlite3.connect(path.as_uri()+'?mode=rw',uri=True,timeout=10)
 db.execute('PRAGMA foreign_keys=ON')
 backup=None
 try:
  if db.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise ValueError('Database integrity check failed.')
  before=inspect(db)
  changed=[c for c in before if c['app_change'] or c['institution_changes']]
  if apply and changed:
   backup=path.with_name(path.name+'.before-login-repair-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.sqlite')
   fd=os.open(backup,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
   dest=sqlite3.connect(backup)
   try:
    db.backup(dest)
    if dest.execute('PRAGMA integrity_check').fetchone()!=('ok',):raise ValueError('Backup integrity check failed.')
   finally:dest.close()
   db.execute('BEGIN IMMEDIATE')
   try:
    current=inspect(db)
    if current!=before:raise ValueError('Credential state changed during repair; rerun inspection.')
    for c in changed:
     if c['app_change']:db.execute('UPDATE users SET email=?,password_hash=? WHERE id=?',(c['email'],password_hash('123'),c['id']))
     for lid,_ in c['institution_changes']:
      db.execute('UPDATE institution_logins SET username=?,password_hash=? WHERE id=? AND user_id=?',(c['email'],password_hash('123'),lid,c['id']))
     db.execute('DELETE FROM sessions WHERE user_id=?',(c['id'],))
     db.execute('DELETE FROM login_challenges WHERE user_id=?',(c['id'],))
     db.execute('DELETE FROM link_previews WHERE user_id=?',(c['id'],))
    after=inspect(db)
    if any(c['app_change'] or c['institution_changes'] for c in after):raise ValueError('Credential verification failed; transaction rolled back.')
    if db.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Foreign key check failed; transaction rolled back.')
    db.commit()
   except Exception:
    db.rollback();raise
  result={'database':str(path),'mode':'apply' if apply else 'inspect','known_users':len(before),
   'users_needing_repair':len(changed),'app_credentials_needing_repair':sum(c['app_change'] for c in before),
   'institution_credentials_needing_repair':sum(len(c['institution_changes']) for c in before),
   'backup':str(backup) if backup else None,'applied':bool(apply and changed),
   'next_step':'Start a fresh login challenge. Financial records and saved connections were not modified.' if apply else 'If this is the active demo database, rerun with --apply to repair recognized demo credentials.'}
  return result
 finally:db.close()

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--database',required=True);p.add_argument('--apply',action='store_true');args=p.parse_args()
 try:print(json.dumps(repair(args.database,args.apply),indent=2))
 except (ValueError,sqlite3.Error) as error:raise SystemExit(str(error))
