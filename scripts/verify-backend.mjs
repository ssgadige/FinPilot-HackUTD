import { spawn } from 'node:child_process';
import { mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync,mkdirSync,existsSync,statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes,createHash } from 'node:crypto';
const outputDir='artifacts/backend';
const privateDir=mkdtempSync(join(tmpdir(),'finpilot-verification-')),database=join(privateDir,'demo.sqlite');
const canaries=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')],report={checks:[],live_provider:'not_attempted',financial_source_mode:'fixture'};
const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',OFFERS_MODE:'fixture',NVIDIA_API_KEY:'',NEMOTRON_MODEL:'',OTP_HMAC_SECRET:canaries[0],DATABASE_PATH:database};
const secrets=[...canaries];
for(const file of ['.env.local','.env'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split('\n')) {
  const at=line.indexOf('=');if(at<0)continue;const key=line.slice(0,at),value=line.slice(at+1).trim();
  if(/SECRET|PASSWORD|API_KEY|SMTP_PASS/.test(key)&&value.length>=8)secrets.push(value.replace(/^['"]|['"]$/g,''));
}
function redacted(text){for(const value of secrets)text=text.split(value).join('[redacted]');return text;}
async function run(label,command,args,extra={}) {
  const started=Date.now();
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(command,args,{env:{...env,...extra},stdio:['ignore','pipe','pipe']});let text='';
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{text+=chunk;if(text.length>8_000_000)child.kill();});
    child.on('error',reject);child.on('exit',code=>resolve({code,text}));
  });
  if(result.code!==0){process.stderr.write(redacted(result.text));throw Error(label+' failed');}
  for(const value of secrets)if(result.text.includes(value))throw Error('Secret appeared in '+label+' output');
  report.checks.push({name:label,status:'passed',elapsed_ms:Date.now()-started});console.log(label+': passed');return result.text;
}
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(path,e.name)):[join(path,e.name)]);}
try {
  const pkg=JSON.parse(readFileSync('package.json')),lock=JSON.parse(readFileSync('package-lock.json')).packages[''];
  for(const key of ['dependencies','devDependencies'])if(JSON.stringify(Object.entries(pkg[key]).sort())!==JSON.stringify(Object.entries(lock[key]).sort()))throw Error('Lockfile differs from package dependencies');
  await run('setup','npm',['run','setup']);const credentials=readFileSync(join(privateDir,'demo-credentials.json'));
  await run('repeat setup','npm',['run','setup']);if(!credentials.equals(readFileSync(join(privateDir,'demo-credentials.json'))))throw Error('Repeat setup changed credentials');
  for(const user of JSON.parse(credentials)){secrets.push(user.app_password,...user.institutions.map(i=>i.password));}
  await run('seed validation','python3',['-c','import sys;sys.path.insert(0,"scripts");from validate_seed import validate;validate(sys.argv[1])',database]);
  await run('backend acceptance','npm',['run','test:backend']);
  await run('agent/provider security','npm',['run','test:agents']);
  await run('existing UI regression','npm',['test'],{NODE_ENV:'test'});
  await run('typecheck','npm',['run','typecheck']);
  await run('production build','npm',['run','build'],{NODE_ENV:'production',NVIDIA_API_KEY:canaries[1],NEMOTRON_MODEL:'nvidia/nemotron-test'});
  let scanned=0;for(const file of files('.next/static'))if(/\.(?:js|json|map)$/.test(file)){const content=readFileSync(file);for(const secret of secrets)if(content.includes(secret))throw Error('Secret in browser artifact');scanned++;}
  report.checks.push({name:'browser bundle secret scan',status:'passed',files:scanned});console.log('browser bundle secret scan: passed');
  await run('production HTTP + SMTP','node',['--import','tsx','scripts/smoke-backend.ts']);
  await run('Python seed tests','python3',['-m','unittest','discover','-s','tests','-v']);
  await run('disposable reset','python3',['scripts/seed_demo.py','--database',database,'--reset']);
  await run('reset migration','npm',['run','db:migrate']);
  await run('reset validation','python3',['-c','import sys;sys.path.insert(0,"scripts");from validate_seed import validate;validate(sys.argv[1])',database]);
  if(statSync(database).mode&0o077)throw Error('Database permissions are not private');
  report.status='passed';report.lockfile_sha256=createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
  mkdirSync(outputDir,{recursive:true});writeFileSync(join(outputDir,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log('Backend verification passed. Live Nemotron smoke is separate and requires configured credentials.');
}catch(error){console.error(redacted(error.message));process.exitCode=1;}
finally{rmSync(privateDir,{recursive:true,force:true});}
