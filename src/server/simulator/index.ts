import { createHash, randomInt } from 'node:crypto';
import { Store } from '../db';
import { Auth, equal, hash, token, iso, verifyPassword } from '../auth';
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
  constructor(readonly store: Store, readonly now=()=>Date.now()) {
    store.exec(`CREATE TABLE IF NOT EXISTS institution_challenges (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, institution_id TEXT NOT NULL,
      session_hash TEXT NOT NULL, binding_hash TEXT NOT NULL, code_hmac TEXT NOT NULL,
      expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TEXT, last_sent_at TEXT NOT NULL)`);
  }
  async begin(auth:Auth,uid:string,sessionHash:string,institution:string,username:string,password:string) {
    const login=this.store.one('SELECT password_hash FROM institution_logins WHERE user_id=? AND institution_id=? AND username=?',uid,institution,username);
    if(!login||!verifyPassword(password,login.password_hash))fail(401,'invalid_simulator_login','Invalid demo institution credentials');
    const id=token(),binding=token(),code=String(randomInt(0,1000000)).padStart(6,'0');
    const domain=`institution:${uid}:${institution}:${id}`;
    this.store.exec('INSERT INTO institution_challenges VALUES(?,?,?,?,?,?,?,0,NULL,?)',id,uid,institution,sessionHash,hash(binding),auth.hmac(domain,code),iso(this.now()+300000),iso(this.now()));
    try{await auth.delivery.send(this.store.user(uid).email,code);}catch(error){this.store.exec('UPDATE institution_challenges SET consumed_at=? WHERE id=? AND user_id=?',iso(this.now()),id,uid);throw error;}
    return {challenge_id:id,masked_email:this.store.user(uid).email.replace(/^(.).+(@.+)$/,'$1***$2'),expires_in_seconds:300,resend_after_seconds:60,binding};
  }
  challenge(uid:string,sessionHash:string,id:string,binding:string) {
    const c=this.store.one('SELECT * FROM institution_challenges WHERE id=? AND user_id=? AND session_hash=?',id,uid,sessionHash);
    if(!c||!equal(c.binding_hash,hash(binding))||c.consumed_at||c.attempts>=5)fail(401,'invalid_institution_code','Invalid verification challenge');
    if(c.expires_at<=iso(this.now()))fail(410,'expired_institution_code','Institution verification expired; start again');
    return c;
  }
  verify(auth:Auth,uid:string,sessionHash:string,id:string,binding:string,code:string) {
    const result=this.store.atomic(()=>{
      const c=this.challenge(uid,sessionHash,id,binding);
      this.store.exec('UPDATE institution_challenges SET attempts=attempts+1 WHERE id=? AND user_id=?',id,uid);
      if(!equal(c.code_hmac,auth.hmac(`institution:${uid}:${c.institution_id}:${id}`,code)))return null;
      this.store.exec('UPDATE institution_challenges SET consumed_at=? WHERE id=? AND user_id=?',iso(this.now()),id,uid);
      return this.verifiedPreview(uid,c.institution_id);
    });
    if(!result)fail(401,'invalid_institution_code','Incorrect verification code');
    return result;
  }
  async resend(auth:Auth,uid:string,sessionHash:string,id:string,binding:string) {
    auth.throttle(`institution-resend:${uid}:${id}`,10,3600000);
    const c=this.challenge(uid,sessionHash,id,binding);
    if(this.now()-Date.parse(c.last_sent_at)<60000)fail(429,'cooldown','Wait before requesting another code');
    const code=String(randomInt(0,1000000)).padStart(6,'0');
    this.store.exec('UPDATE institution_challenges SET code_hmac=?,expires_at=?,last_sent_at=? WHERE id=? AND user_id=?',auth.hmac(`institution:${uid}:${c.institution_id}:${id}`,code),iso(this.now()+300000),iso(this.now()),id,uid);
    try{await auth.delivery.send(this.store.user(uid).email,code);}catch(error){this.store.exec('UPDATE institution_challenges SET consumed_at=? WHERE id=? AND user_id=?',iso(this.now()),id,uid);throw error;}
  }
  list(uid:string) {
    return this.store.all("SELECT id,institution_id,status,last_sync_at FROM connections WHERE user_id=? AND status='active' ORDER BY id",uid).map(c=>({...c,account_ids:this.store.all('SELECT ca.account_id FROM connection_accounts ca JOIN accounts a ON a.id=ca.account_id AND a.user_id=ca.user_id WHERE ca.connection_id=? AND ca.user_id=? AND a.user_id=? ORDER BY ca.account_id',c.id,uid,uid).map(a=>a.account_id)}));
  }
  preview(uid: string, institution: string, username: string, password: string) {
    const login = this.store.one('SELECT * FROM institution_logins WHERE user_id=? AND institution_id=? AND username=?',uid,institution,username);
    if (!login || !verifyPassword(password,login.password_hash)) fail(401,'invalid_simulator_login','Invalid demo institution credentials');
    return this.verifiedPreview(uid,institution);
  }
  private verifiedPreview(uid:string,institution:string) {
    const preview = token();
    this.store.exec('INSERT INTO link_previews VALUES(?,?,?,?,NULL)',hash(preview),uid,institution,iso(this.now()+300000));
    return {preview_token:preview,institution_id:institution,expires_at:iso(this.now()+300000),consent_version:'v1',simulation:true,warning:'Simulation only. Never enter real bank credentials.',accounts:this.store.all('SELECT id,label,last_four,kind FROM accounts WHERE user_id=? AND institution_id=? ORDER BY id',uid,institution).map(a=>({id:a.id,label:a.label,last_four:a.last_four,kind:a.kind,records:['Account balance and metadata','Installed transaction history','Related recurring payments and debts']}))};
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
      return {id,connection:{id,institution_id:p.institution_id,status:'active',account_ids:input.account_ids,last_sync_at:iso(this.now())},simulation:true,sync:{source_mode:'fixture',snapshot_version:this.store.user(uid).snapshot_version,imported_transactions:0}};
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
