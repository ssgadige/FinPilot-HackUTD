import { createHash } from 'node:crypto';
import { Store } from '../db';
import { hash, token, iso, verifyPassword } from '../auth';
import { fail, found } from '../errors';
export function idempotent<T>(store: Store, uid: string, scope: string, key: string, input: unknown, fn: () => T): T {
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return store.atomic(()=> {
    const previous = store.one('SELECT * FROM request_keys WHERE user_id=? AND scope=? AND key=?',uid,scope,key);
    if (previous) {
      if (previous.fingerprint!==fingerprint) fail(409,'idempotency_conflict','Key was used with different input');
      return JSON.parse(previous.result_json);
    }
    const result = fn();
    store.exec('INSERT INTO request_keys VALUES(?,?,?,?,?)',uid,scope,key,fingerprint,JSON.stringify(result));
    return result;
  });
}
export class Simulator {
  constructor(readonly store: Store, readonly now=()=>Date.now()) {}
  preview(uid: string, institution: string, username: string, password: string) {
    const login = this.store.one('SELECT * FROM institution_logins WHERE user_id=? AND institution_id=? AND username=?',uid,institution,username);
    if (!login || !verifyPassword(password,login.password_hash)) fail(401,'invalid_simulator_login','Invalid demo institution credentials');
    const preview = token();
    this.store.exec('INSERT INTO link_previews VALUES(?,?,?,?,NULL)',hash(preview),uid,institution,iso(this.now()+300000));
    return {preview_token:preview,simulation:true,warning:'Simulation only. Never enter real bank credentials.',accounts:this.store.all('SELECT id,label,last_four,kind FROM accounts WHERE user_id=? AND institution_id=? ORDER BY id',uid,institution)};
  }
  connect(uid: string, input: {preview_token:string;account_ids:string[];consent_version:string;idempotency_key:string}) {
    return idempotent(this.store,uid,'connection',input.idempotency_key,input,()=> {
      const p = this.store.one('SELECT * FROM link_previews WHERE token_hash=? AND user_id=?',hash(input.preview_token),uid);
      if (!p || p.consumed_at || p.expires_at<=iso(this.now())) fail(400,'invalid_preview','Preview expired or consumed');
      if (input.consent_version!=='v1') fail(400,'invalid_consent','Consent version v1 required');
      for (const id of input.account_ids) {
        found(this.store.one('SELECT id FROM accounts WHERE id=? AND user_id=? AND institution_id=?',id,uid,p.institution_id));
        if (this.store.accounts(uid).some(a=>a.id===id)) fail(409,'already_linked','Account already linked');
      }
      const id = token();
      this.store.exec("INSERT INTO connections VALUES(?,?,?,'active',?,?,?)",id,uid,p.institution_id,input.consent_version,iso(this.now()),input.idempotency_key);
      for (const aid of input.account_ids) this.store.exec('INSERT INTO connection_accounts VALUES(?,?,?)',id,uid,aid);
      this.store.exec('UPDATE link_previews SET consumed_at=? WHERE token_hash=?',iso(this.now()),hash(input.preview_token));
      this.store.invalidate(uid);
      return {id,simulation:true,sync:{source_mode:'fixture',snapshot_version:this.store.user(uid).snapshot_version,imported_transactions:0}};
    });
  }
  connection(uid: string,id: string) { return found(this.store.one("SELECT * FROM connections WHERE id=? AND user_id=? AND status='active'",id,uid)); }
  sync(uid: string,id: string,key: string) {
    this.connection(uid,id);
    return idempotent(this.store,uid,`sync:${id}`,key,{},()=> {
      this.store.exec('UPDATE connections SET last_sync_at=? WHERE id=? AND user_id=?',iso(this.now()),id,uid);
      // Seed ledger is canonical; synchronization never copies it or invents new financial records.
      return {snapshot_version:this.store.user(uid).snapshot_version,imported_transactions:0,source_mode:'fixture'};
    });
  }
  revoke(uid: string,id: string) {
    return this.store.atomic(()=> {
      this.connection(uid,id);
      this.store.exec("UPDATE connections SET status='revoked' WHERE id=? AND user_id=?",id,uid);
      this.store.invalidate(uid);
      // Accepted plan remains for audit, but loses its accepted status after access is revoked.
      this.store.exec("UPDATE plans SET status='stale' WHERE user_id=? AND status='accepted'",uid);
      return {revoked:true,snapshot_version:this.store.user(uid).snapshot_version};
    });
  }
}
