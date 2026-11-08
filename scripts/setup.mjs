import './init_env.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import nextEnv from '@next/env';

const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--prepare-demo'))throw Error('Usage: npm run setup [-- --prepare-demo]');
nextEnv.loadEnvConfig(process.cwd(),process.env.NODE_ENV!=='production',undefined,true);
if(!process.env.OTP_HMAC_SECRET||process.env.OTP_HMAC_SECRET.length<32)
  throw Error('Configure OTP_HMAC_SECRET with at least 32 characters in your private environment before starting FinPilot. Existing files were preserved.');

function pythonCommand() {
  const candidates=process.env.PYTHON?[[process.env.PYTHON,[]]]:
    process.platform==='win32'?[['python',[]],['python3',[]],['py',['-3']]]:[['python3',[]],['python',[]]];
  for(const [command,prefix] of candidates){
    const result=spawnSync(command,[...prefix,'-c','import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)'],{stdio:'pipe'});
    if(!result.error&&result.status===0)return {command,prefix};
  }
  throw Error('Python 3.11+ is required. Install Python on PATH, or set PYTHON to its executable path.');
}
let python;
const runPython=(...arguments_)=>{
  python??=pythonCommand();
  return execFileSync(python.command,[...python.prefix,...arguments_],{stdio:'inherit'});
};
const database=resolve(process.env.DATABASE_PATH || './data/finpilot-demo.sqlite');
const created=!existsSync(database);
if(created)runPython('scripts/seed_demo.py','--database',database);
else console.log('Existing database preserved; applying migrations only.');
execFileSync(process.execPath,['--import','tsx','scripts/bootstrap.ts'],{stdio:'inherit',env:{...process.env,DATABASE_PATH:database}});
const prepareRequested=args.includes('--prepare-demo');
if(prepareRequested&&process.env.DEMO_MODE!=='true')throw Error('Demo preparation requires DEMO_MODE=true; the existing database was not expanded.');
if((created&&process.env.DEMO_MODE==='true')||prepareRequested){
  runPython('scripts/prepare_demo_dashboards.py','--database',database,'--expand-account-types','--apply');
  runPython('scripts/validate_presentation.py','--database',database);
}else if(!created&&process.env.DEMO_MODE==='true'){
  console.log('To explicitly upgrade an older demo to seven account types: npm run demo:prepare. This creates a backup first.');
}
console.log(`Database ready. Open ${new URL(process.env.APP_URL||'http://127.0.0.1:3000').origin}/login after starting the app.`);
console.log('Email codes require SMTP. For the local inbox: docker compose up -d mailpit (http://localhost:8025).');
