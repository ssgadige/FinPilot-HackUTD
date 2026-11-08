import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,join,sep} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

function project(){
 const repo=process.cwd(),dir=mkdtempSync(join(tmpdir(),'finpilot-setup-'));
 for(const file of ['package.json','scripts/setup.mjs','scripts/init_env.mjs','scripts/bootstrap.ts','scripts/seed_demo.py','scripts/prepare_demo_dashboards.py','scripts/validate_presentation.py','data/schema.sql','src/server/db/index.ts','src/server/errors.ts']){
  mkdirSync(dirname(join(dir,file)),{recursive:true});copyFileSync(join(repo,file),join(dir,file));
 }
 symlinkSync(join(repo,'node_modules'),join(dir,'node_modules'),'junction');
 const env:NodeJS.ProcessEnv={...process.env,NODE_ENV:'development'};
 for(const key of Object.keys(env))if(/^(NVIDIA|NEMOTRON|SMTP_|OTP_|SESSION_|APP_URL$|DATABASE_PATH$|DEMO_MODE$|ALLOW_LOCAL_HTTP$|PYTHON$)/.test(key))delete (env as Record<string,string|undefined>)[key];
 return {dir,env,run(extra:Record<string,string>={},args:string[]=[]){return execFileSync(process.execPath,['scripts/setup.mjs',...args],{cwd:dir,env:{...env,...extra},stdio:'pipe',timeout:60000});},close(){
  const target=realpathSync(dir),root=realpathSync(tmpdir());
  if(!target.startsWith(root+sep)||!basename(target).startsWith('finpilot-setup-'))throw Error('Refusing unsafe test cleanup');
  rmSync(target,{recursive:true,force:true});
 }};
}
test('fresh clone setup provisions all ten dashboards, preserves configuration and never regrants revoked scope on repeat',()=>{
 const p=project();
 try{
  p.run();const configuration=readFileSync(join(p.dir,'.env.local'),'utf8');
  assert.ok(configuration.includes('APP_URL=http://127.0.0.1:3000'));
  assert.ok((configuration.match(/^OTP_HMAC_SECRET=(.+)$/m)?.[1].length??0)>=32);
  const db=new DatabaseSync(join(p.dir,'data/finpilot-demo.sqlite'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM (SELECT user_id FROM accounts GROUP BY user_id HAVING COUNT(DISTINCT kind)=7)').get()!.n,10);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n,71);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get()!.n,13322);
  db.exec("UPDATE connections SET status='revoked' WHERE user_id='demo-01'");
  db.close();p.run();
  assert.ok(readFileSync(join(p.dir,'.env.local'),'utf8')===configuration,'Existing private configuration is preserved');
  const repeat=new DatabaseSync(join(p.dir,'data/finpilot-demo.sqlite'));
  assert.equal(repeat.prepare("SELECT COUNT(*) AS n FROM connections WHERE user_id='demo-01' AND status='active'").get()!.n,0);
  assert.equal(repeat.prepare('SELECT COUNT(*) AS n FROM transactions').get()!.n,13322);repeat.close();
 }finally{p.close();}
});
test('existing .env provider/OTP configuration and process-selected database path are respected without overwriting files',()=>{
 const p=project();
 try{
  const configuration='OTP_HMAC_SECRET='+Array(40).fill('x').join('')+'\nAPP_URL=http://127.0.0.1:3000\nALLOW_LOCAL_HTTP=true\nDEMO_MODE=true\nNVIDIA_API_KEY=test-only-placeholder\nNEMOTRON_MODEL=nvidia/nemotron-test\n';
  writeFileSync(join(p.dir,'.env'),configuration);
  const custom=join(p.dir,'custom data','presentation.sqlite');
  p.run({DATABASE_PATH:custom});
  assert.ok(existsSync(custom));assert.ok(!existsSync(join(p.dir,'data/finpilot-demo.sqlite')));
  assert.ok(readFileSync(join(p.dir,'.env'),'utf8')===configuration,'Existing server configuration is preserved');
  assert.ok(!existsSync(join(p.dir,'.env.local')),'Existing valid environment secret is not replaced');
 }finally{p.close();}
});
test('older unlinked clones upgrade only through explicit demo preparation',()=>{
 const p=project();
 try{
  p.run({DEMO_MODE:'false'});
  const path=join(p.dir,'data/finpilot-demo.sqlite');let db=new DatabaseSync(path);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n,41);db.close();
  p.run({DEMO_MODE:'true'});db=new DatabaseSync(path);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n,41);db.close();
  p.run({DEMO_MODE:'true'},['--prepare-demo']);db=new DatabaseSync(path);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM accounts').get()!.n,71);db.close();
 }finally{p.close();}
});
test('generating a missing OTP secret does not mask configured origin, database or provider settings',()=>{
 const p=project();
 try{
  const custom=join(p.dir,'existing config','dashboard.sqlite');
  const configuration='APP_URL=http://localhost:3000\nALLOW_LOCAL_HTTP=true\nDEMO_MODE=true\nDATABASE_PATH="'+custom.replaceAll('\\','/')+'"\nSMTP_HOST=localhost\nNVIDIA_API_KEY=test-only-placeholder\n';
  writeFileSync(join(p.dir,'.env'),configuration);p.run();
  const generated=readFileSync(join(p.dir,'.env.local'),'utf8');
  assert.ok(!generated.includes('APP_URL='));assert.ok(!generated.includes('DATABASE_PATH='));assert.ok(!generated.includes('NVIDIA_API_KEY='));assert.ok(existsSync(custom));
  assert.ok(readFileSync(join(p.dir,'.env'),'utf8')===configuration,'Existing provider configuration is unchanged');
 }finally{p.close();}
});
test('an explicitly configured short secret is rejected without rotating it or creating a database',()=>{
 const p=project();
 try{
  const configuration='OTP_HMAC_SECRET=test-short\nDEMO_MODE=true\n';
  writeFileSync(join(p.dir,'.env'),configuration);
  assert.throws(()=>p.run());
  assert.ok(readFileSync(join(p.dir,'.env'),'utf8')===configuration,'Invalid existing configuration is preserved');
  assert.ok(!existsSync(join(p.dir,'.env.local')));assert.ok(!existsSync(join(p.dir,'data/finpilot-demo.sqlite')));
 }finally{p.close();}
});
