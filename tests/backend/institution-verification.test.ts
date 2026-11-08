import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Auth } from '../../src/server/auth';
import { Simulator } from '../../src/server/simulator';
import { fixture } from './fixtures';

test('institution challenge gates previews: ownership, binding, expiry, attempts, resend and replay',async()=>{
 const f=fixture();let now=Date.now(),delivered='';
 const auth=new Auth(f.store,{secret:'test-only-institution-secret-'.repeat(2),appUrl:'http://localhost:3000',allowLocalHttp:true},{async send(_to,code){delivered=code;}},()=>now);
 const sim=new Simulator(f.store,()=>now),credential=f.credentials[0].institutions[0],uid=f.credentials[0].id||'demo-01';
 try {
  const initial=f.store.one('SELECT COUNT(*) AS n FROM transactions')!.n;
  const begin=()=>sim.begin(auth,uid,'session-one',credential.institution_id,credential.username,credential.password);
  const c=await begin(),code=delivered;
  assert.equal('preview_token' in c,false);assert.equal('accounts' in c,false);
  assert.equal(f.store.one('SELECT COUNT(*) AS n FROM link_previews')!.n,0);
  assert.throws(()=>sim.verify(auth,'demo-02','session-one',c.challenge_id,c.binding,code),{code:'invalid_institution_code'});
  assert.throws(()=>sim.verify(auth,uid,'session-two',c.challenge_id,c.binding,code),{code:'invalid_institution_code'});
  assert.throws(()=>sim.verify(auth,uid,'session-one',c.challenge_id,'other-attempt',code),{code:'invalid_institution_code'});
  assert.throws(()=>sim.verify(auth,uid,'session-one',c.challenge_id,c.binding,code==='000000'?'111111':'000000'),{code:'invalid_institution_code'});
  await assert.rejects(sim.resend(auth,uid,'session-one',c.challenge_id,c.binding),{code:'cooldown'});
  now+=60001;await sim.resend(auth,uid,'session-one',c.challenge_id,c.binding);
  if(code!==delivered)assert.throws(()=>sim.verify(auth,uid,'session-one',c.challenge_id,c.binding,code),{code:'invalid_institution_code'});
  const preview=sim.verify(auth,uid,'session-one',c.challenge_id,c.binding,delivered);
  assert.ok(preview.preview_token);assert.equal(preview.institution_id,credential.institution_id);
  assert.throws(()=>sim.verify(auth,uid,'session-one',c.challenge_id,c.binding,delivered),{code:'invalid_institution_code'});
  const expired=await begin();now+=300001;
  assert.throws(()=>sim.verify(auth,uid,'session-one',expired.challenge_id,expired.binding,delivered),{code:'expired_institution_code'});
  const exhausted=await begin(),wrong=delivered==='000000'?'111111':'000000';
  for(let i=0;i<5;i++)assert.throws(()=>sim.verify(auth,uid,'session-one',exhausted.challenge_id,exhausted.binding,wrong),{code:'invalid_institution_code'});
  assert.throws(()=>sim.verify(auth,uid,'session-one',exhausted.challenge_id,exhausted.binding,delivered),{code:'invalid_institution_code'});
  assert.equal(f.store.accounts(uid).length,0);assert.equal(f.store.one('SELECT COUNT(*) AS n FROM transactions')!.n,initial);
 }finally{f.close();}
});
