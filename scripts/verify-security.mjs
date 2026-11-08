import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import assert from 'node:assert/strict';
// Local audit only. Values are read for comparison and never printed.
const secretNames=['NVIDIA_API_KEY','OTP_HMAC_SECRET','SMTP_PASS','SESSION_SECRET'];
const secrets=new Set(secretNames.map(k=>process.env[k]).filter(Boolean));
const logPaths=[];
for(let n=2;n<process.argv.length;n+=2){
  assert.equal(process.argv[n],'--log','Expected --log followed by a local log path');
  assert.ok(process.argv[n+1]&&existsSync(process.argv[n+1]),'Log file does not exist');
  logPaths.push(process.argv[n+1]);
}
for(const name of ['.env','.env.local'])if(existsSync(name)){
  for(const line of readFileSync(name,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if(m&&secretNames.includes(m[1])){
      const value=m[2].replace(/^(['"])(.*)\1$/,'$2');if(value.length>=8)secrets.add(value);
    }
  }
}
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/^(?:\.env(?:\..+)?|data\/(?:.*\.sqlite(?:-wal|-shm)?|demo-credentials\.json|seed-manifest\.json))$/;
assert.ok(!tracked.some(p=>forbidden.test(p)&&p!=='.env.example'),'A private generated/configuration file is tracked');
let scanned=0;
for(const file of new Set(files)){
  if(!existsSync(file)||!statSync(file).isFile())continue;
  const data=readFileSync(file);scanned++;
  for(const secret of secrets)assert.ok(!data.includes(Buffer.from(secret)),`Configured secret found in reviewable source: ${file}`);
}
assert.ok(existsSync('.next/static'),'Run npm run build before browser-bundle audit');
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);}
const browser=walk('.next/static').filter(p=>/\.(?:js|map)$/.test(p));
assert.ok(browser.length>0,'No browser JavaScript found');
for(const file of browser){
  const data=readFileSync(file);
  for(const secret of secrets)assert.ok(!data.includes(Buffer.from(secret)),`Configured secret found in browser bundle: ${file}`);
  for(const name of [...secretNames,'password_hash','code_hmac','pending_binding_hash'])assert.ok(!data.includes(Buffer.from(name)),`Server-only field found in browser bundle: ${file}`);
}
for(const file of logPaths){
  const data=readFileSync(file);
  for(const secret of secrets)assert.ok(!data.includes(Buffer.from(secret)),`Configured secret found in local log: ${file}`);
}
for(const file of ['.gitignore','.dockerignore']){
  const text=readFileSync(file,'utf8');assert.ok(text.includes('.env'),`${file} must exclude environment files`);
  assert.ok(text.includes('sqlite'),`${file} must exclude databases`);
  assert.ok(text.includes('demo-credentials.json'),`${file} must exclude generated credentials`);
}
const manifest=JSON.parse(readFileSync('package.json','utf8'));
const lock=JSON.parse(readFileSync('package-lock.json','utf8')).packages[''];
for(const field of ['dependencies','devDependencies'])assert.deepEqual(manifest[field],lock[field],`Lockfile ${field} differs from package.json`);
console.log(JSON.stringify({status:'passed',mode:'local_static_audit',source_files:scanned,browser_chunks:browser.length,log_files:logPaths.length,
  checks:['configured secrets absent from reviewable source and browser bundles','configured secrets absent from supplied local logs','server-only fields absent from browser bundles','generated/private files excluded from Git and Docker','dependency declarations match lockfile'],
  limitation:'Audits the current checkout/build; it does not scan deleted historical Git objects or certify production security.'},null,2));
