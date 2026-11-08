import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Auth,iso } from '../../src/server/auth';
import { Simulator } from '../../src/server/simulator';
import { createApi } from '../../src/server/api';
import { fixture } from './fixtures';
test('FP-11: simulator credential ownership, consent, selected visibility, replay, revoke and evidence',async()=>{
 const f=fixture(),db=f.store,sim=new Simulator(db);let code='';const auth=new Auth(db,{secret:'fixture-secret-'.repeat(4),appUrl:'http://localhost:3000',allowLocalHttp:true},{async send(_email,value){code=value;}});
 try {
  const c=f.credentials[0].institutions[0];assert.throws(()=>sim.preview('demo-02',c.institution_id,c.username,c.password),{code:'invalid_simulator_login'});assert.throws(()=>sim.preview('demo-01','wrong',c.username,c.password),{code:'invalid_simulator_login'});
  const preview=sim.preview('demo-01',c.institution_id,c.username,c.password);const input={preview_token:preview.preview_token,account_ids:[preview.accounts[0].id],consent_version:'v1',idempotency_key:'link'};
  assert.throws(()=>sim.connect('demo-01',{...input,account_ids:['demo-02-a1']}),{code:'not_found'});const linked=sim.connect('demo-01',input);assert.deepEqual(sim.connect('demo-01',input),linked);
  assert.deepEqual(db.accounts('demo-01').map(a=>a.id),input.account_ids);assert.deepEqual(sim.list('demo-02'),[]);
  const count=db.one('SELECT COUNT(*) AS n FROM transactions')!.n;assert.deepEqual(sim.sync('demo-01',linked.id,'sync'),sim.sync('demo-01',linked.id,'sync'));assert.equal(db.one('SELECT COUNT(*) AS n FROM transactions')!.n,count);assert.throws(()=>sim.sync('demo-02',linked.id,'sync'),{code:'not_found'});
  const challenge=await auth.login(f.credentials[0].email,f.credentials[0].app_password,'fixture');const session=auth.verify(challenge.challenge_id,code,challenge.pending);const handle=createApi({store:db,auth,simulator:sim});
  const request=async(path:string,method='GET',body?:unknown)=>handle(new Request('http://localhost:3000/api/v1/'+path,{method,headers:{origin:'http://localhost:3000',cookie:'fp_session='+session.session,'x-csrf-token':session.csrf,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));
  assert.equal((await request('connections')).status,200);assert.equal((await request('connections/preview','POST',{institution_id:c.institution_id,demo_username:c.username,demo_password:c.password,user_id:'demo-02'})).status,400);
  db.exec("INSERT INTO runs VALUES('evidence-run','demo-01','test','completed',?,'evidence-run',?,NULL)",db.user('demo-01').snapshot_version,iso());
  db.exec("INSERT INTO evidence VALUES('evidence','demo-01','evidence-run','account',?,'fixture',?,'{}')",input.account_ids[0],iso());assert.equal(db.evidence('demo-01','evidence')!.id,'evidence');
  db.exec("INSERT INTO plans VALUES('plan','demo-01',NULL,1,'accepted',?,NULL,'{}',?)",db.user('demo-01').snapshot_version,iso());
  assert.equal((await request('connections/'+linked.id,'DELETE',{confirmation:true})).status,200);assert.deepEqual(db.scoped('transactions','demo-01'),[]);assert.deepEqual(db.scoped('subscriptions','demo-01'),[]);assert.throws(()=>db.evidence('demo-01','evidence'),{code:'not_found'});assert.equal(db.one("SELECT status FROM plans WHERE id='plan'")!.status,'stale');assert.throws(()=>sim.sync('demo-01',linked.id,'after-revoke'),{code:'not_found'});
 }finally{f.close();}
});
