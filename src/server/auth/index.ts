import { createHash, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { Store } from '../db';
import { fail, found } from '../errors';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const iso = (n = Date.now()) => new Date(n).toISOString();
export function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); }
export function verifyPassword(password: string, encoded: string) {
  try {
    const [scheme,n,r,p,salt,digest] = encoded.split('$');
    if (scheme !== 'scrypt' || n !== '16384' || r !== '8' || p !== '1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(digest)) return false;
    return equal(scryptSync(password, Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1}).toString('hex'), digest);
  } catch { return false; }
}
// Equal-cost password check for unknown users; no account enumeration through the response.
const dummy = `scrypt$16384$8$1$${'00'.repeat(16)}$${'00'.repeat(32)}`;
export interface AuthConfig { secret: string; appUrl: string; allowLocalHttp: boolean; }
export interface Delivery { send(email: string, code: string): Promise<void>; }
export function smtpDelivery(): Delivery {
  return { async send(email, code) {
    const host = process.env.SMTP_HOST;
    if (!host) fail(503,'smtp_unavailable','Email delivery is not configured');
    const local = ['127.0.0.1','localhost','mailpit'].includes(host);
    const owned = (process.env.SMTP_ALLOWED_RECIPIENTS || '').split(',').map(s=>s.trim().toLowerCase());
    if (!(local && email.endsWith('@example.test')) && !owned.includes(email.toLowerCase())) fail(503,'smtp_unavailable','Recipient is not configured');
    const transport = nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT || 1025),secure:process.env.SMTP_SECURE==='true',
      requireTLS: !local && process.env.SMTP_SECURE !== 'true', connectionTimeout:5000, socketTimeout:10000,
      auth:process.env.SMTP_USER ? {user:process.env.SMTP_USER,pass:process.env.SMTP_PASS} : undefined});
    try { await transport.sendMail({from:process.env.SMTP_FROM || 'finpilot@example.test',to:email,subject:'FinPilot verification',text:`Your FinPilot verification code is ${code}. It expires in five minutes.`}); }
    catch { fail(502,'smtp_failed','Unable to deliver verification email'); }
    finally { transport.close(); }
  }};
}
export class Auth {
  constructor(readonly store: Store, readonly config: AuthConfig, readonly delivery: Delivery, readonly now = () => Date.now()) {
    if (config.secret.length < 32) fail(503,'auth_unavailable','Configure an OTP secret of at least 32 characters');
    const url = new URL(config.appUrl);
    if (url.protocol !== 'https:' && !(config.allowLocalHttp && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))) fail(503,'auth_unavailable','HTTPS or explicit local HTTP configuration required');
  }
  hmac(id: string, code: string) { return createHmac('sha256',this.config.secret).update(`${id}:${code}`).digest('hex'); }
  throttle(key: string, limit: number, window = 900000) {
    const now = this.now();
    this.store.atomic(()=> {
      this.store.exec('DELETE FROM auth_limits WHERE expires<=?',now);
      this.store.exec('INSERT INTO auth_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',hash(key),now+window);
    });
    if (found(this.store.one('SELECT count FROM auth_limits WHERE key=?',hash(key))).count > limit) fail(429,'rate_limit','Too many attempts; try later');
  }
  cleanup() {
    this.store.exec('DELETE FROM sessions WHERE expires_at<=? OR last_seen_at<=?',iso(this.now()),iso(this.now()-1800000));
    this.store.exec('DELETE FROM login_challenges WHERE expires_at<=?',iso(this.now()-86400000));
    this.store.exec('DELETE FROM link_previews WHERE expires_at<=?',iso(this.now()));
  }
  async login(email: string, password: string, ip: string) {
    this.cleanup();
    this.throttle(`login-ip:${ip}`,30); this.throttle(`login-account:${email.toLowerCase()}`,10);
    const user = this.store.one('SELECT id,email,password_hash FROM users WHERE email=?',email.toLowerCase());
    if (!verifyPassword(password,user?.password_hash || dummy) || !user) fail(401,'invalid_login','Invalid credentials');
    const id = token(), pending = token(), code = String(randomInt(0,1000000)).padStart(6,'0');
    this.store.exec('INSERT INTO login_challenges VALUES(?,?,?,?,0,NULL,?,?)',id,user.id,this.hmac(id,code),iso(this.now()+300000),iso(this.now()),hash(pending));
    try { await this.delivery.send(user.email,code); }
    catch (e) { this.store.exec('UPDATE login_challenges SET consumed_at=? WHERE id=?',iso(this.now()),id); throw e; }
    return {challenge_id:id, masked_email:user.email.replace(/^(.).+(@.+)$/,'$1***$2'),pending};
  }
  challenge(id: string, pending: string) {
    const c = this.store.one('SELECT * FROM login_challenges WHERE id=?',id);
    if (!c || !equal(c.pending_binding_hash,hash(pending)) || c.consumed_at || c.expires_at<=iso(this.now()) || c.attempts>=5) fail(401,'invalid_code','Invalid or expired verification challenge');
    return c;
  }
  verify(id: string, code: string, pending: string) {
    // Failed attempts must commit too. Never throw inside the attempt transaction.
    const result = this.store.atomic(()=> {
      const c = this.challenge(id,pending);
      this.store.exec('UPDATE login_challenges SET attempts=attempts+1 WHERE id=?',id);
      if (!equal(this.hmac(id,code),c.code_hmac)) return null;
      this.store.exec('UPDATE login_challenges SET consumed_at=? WHERE id=?',iso(this.now()),id);
      const session = token(), csrf = token();
      this.store.exec('INSERT INTO sessions(token_hash,user_id,created_at,last_seen_at,expires_at,csrf_hash) VALUES(?,?,?,?,?,?)',hash(session),c.user_id,iso(this.now()),iso(this.now()),iso(this.now()+28800000),hash(csrf));
      return {session,csrf,user:this.profile(c.user_id)};
    });
    if (!result) fail(401,'invalid_code','Invalid or expired verification challenge');
    return result;
  }
  async resend(id: string, pending: string) {
    this.throttle(`resend:${id}`, 10, 3600000);
    const next = this.store.atomic(()=> {
      const c = this.challenge(id,pending);
      if (this.now()-Date.parse(c.last_sent_at)<60000) fail(429,'cooldown','Wait before requesting another code');
      const code = String(randomInt(0,1000000)).padStart(6,'0');
      this.store.exec('UPDATE login_challenges SET code_hmac=?,expires_at=?,last_sent_at=? WHERE id=?',this.hmac(id,code),iso(this.now()+300000),iso(this.now()),id);
      return {email:this.store.user(c.user_id).email,code};
    });
    try { await this.delivery.send(next.email,next.code); }
    catch(e) { this.store.exec('UPDATE login_challenges SET consumed_at=? WHERE id=?',iso(this.now()),id); throw e; }
  }
  session(raw: string) {
    const s = this.store.one('SELECT * FROM sessions WHERE token_hash=?',hash(raw));
    if (!s || s.expires_at<=iso(this.now()) || Date.parse(s.last_seen_at)<=this.now()-1800000) {
      this.store.exec('DELETE FROM sessions WHERE token_hash=?',hash(raw));
      fail(401,'unauthenticated','Complete password and email verification');
    }
    this.store.exec('UPDATE sessions SET last_seen_at=? WHERE token_hash=?',iso(this.now()),hash(raw)); return s;
  }
  profile(uid: string) { const u = this.store.user(uid); return {id:u.id,display_name:u.name,email:u.email,simulation:true}; }
  protect(request: Request, csrfHash?: string) {
    if (request.headers.get('origin')!==new URL(this.config.appUrl).origin) fail(403,'origin','Same-origin request required');
    if (csrfHash && !equal(hash(request.headers.get('x-csrf-token') || ''),csrfHash)) fail(403,'csrf','Valid CSRF token required');
  }
  logout(raw: string) { this.store.exec('DELETE FROM sessions WHERE token_hash=?',hash(raw)); }
}
