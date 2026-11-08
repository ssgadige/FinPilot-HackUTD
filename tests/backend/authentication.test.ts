import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Auth,hash,iso } from '../../src/server/auth';
import { createApi } from '../../src/server/api';
import { fixture } from './fixtures';
test('FP-10: password/email gate, replay/expiry, attempts, resend, CSRF, delivery failure and logout',async()=>{
 const f=fixture(),db=f.store;let now=Date.now();const mail:string[]=[];
 const auth=new Auth(db,{secret:'fixture-secret-'.repeat(4),appUrl:'http://localhost:3000',allowLocalHttp:true},{async send(_email,code){mail.push(code);}},()=>now);
 const login=()=>auth.login(f.credentials[0].email,f.credentials[0].app_password,'local-test');
 try {
  await assert.rejects(auth.login(f.credentials[0].email,'wrong','wrong'),{code:'invalid_login'});
  await assert.rejects(auth.login('missing@example.test','wrong','wrong'),{code:'invalid_login'});
  const challenge=await login(),code=mail.at(-1)!;assert.equal(db.one('SELECT COUNT(*) AS n FROM sessions')!.n,0);
  assert.throws(()=>auth.session(challenge.pending),{code:'unauthenticated'});
  assert.throws(()=>auth.verify(challenge.challenge_id,code,'wrong-binding'),{code:'invalid_code'});
  const wrong=code==='000000'?'111111':'000000';assert.throws(()=>auth.verify(challenge.challenge_id,wrong,challenge.pending),{code:'invalid_code'});
  const session=auth.verify(challenge.challenge_id,code,challenge.pending);assert.throws(()=>auth.verify(challenge.challenge_id,code,challenge.pending),{code:'invalid_code'});
  const handle=createApi({store:db,auth});
  const request=(path:string,method='GET',extra:Record<string,string>={})=>handle(new Request('http://localhost:3000/api/v1/'+path,{method,headers:{origin:'http://localhost:3000',cookie:'fp_session='+session.session+'; fp_csrf='+session.csrf,'x-csrf-token':session.csrf,...extra}}));
  const me=await request('me');assert.equal(me.status,200);assert.equal(me.headers.get('x-csrf-token'),session.csrf);assert.equal((await me.json()).id,'demo-01');
  assert.equal((await request('me','GET',{cookie:'fp_session='+session.session+'; fp_csrf=invalid'})).headers.get('x-csrf-token'),null);
  assert.equal((await request('auth/logout','POST',{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await request('auth/logout','POST',{origin:'https://other.example'})).status,403);
  assert.equal((await request('auth/logout','POST')).status,204);assert.throws(()=>auth.session(session.session),{code:'unauthenticated'});
  const expired=await login();now+=300001;assert.throws(()=>auth.verify(expired.challenge_id,mail.at(-1)!,expired.pending),{code:'invalid_code'});now-=300001;
  const limited=await login(),right=mail.at(-1)!;for(let i=0;i<5;i++)assert.throws(()=>auth.verify(limited.challenge_id,right==='000000'?'111111':'000000',limited.pending),{code:'invalid_code'});assert.throws(()=>auth.verify(limited.challenge_id,right,limited.pending),{code:'invalid_code'});
  const resend=await login();await assert.rejects(auth.resend(resend.challenge_id,resend.pending),{code:'cooldown'});const old=mail.at(-1)!;now+=60001;await auth.resend(resend.challenge_id,resend.pending);const fresh=mail.at(-1)!;if(old!==fresh)assert.throws(()=>auth.verify(resend.challenge_id,old,resend.pending),{code:'invalid_code'});const signed=auth.verify(resend.challenge_id,fresh,resend.pending);now-=60001;
  db.exec('UPDATE sessions SET expires_at=? WHERE token_hash=?',iso(now-1),hash(signed.session));assert.throws(()=>auth.session(signed.session),{code:'unauthenticated'});
  auth.throttle('limited',1);assert.throws(()=>auth.throttle('limited',1),{code:'rate_limit'});
  const failed=new Auth(db,auth.config,{async send(){throw Error('SMTP unavailable');}},()=>now);const before=db.one('SELECT COUNT(*) AS n FROM sessions')!.n;
  await assert.rejects(failed.login(f.credentials[1].email,f.credentials[1].app_password,'delivery'));assert.equal(db.one('SELECT COUNT(*) AS n FROM sessions')!.n,before);
 }finally{f.close();}
});
