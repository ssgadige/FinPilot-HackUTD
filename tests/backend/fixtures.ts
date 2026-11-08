import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Store } from '../../src/server/db';
export function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'finpilot-issue-'));
 execFileSync('python3',['scripts/seed_demo.py','--database',join(dir,'demo.sqlite')],{stdio:'pipe'});
 const store=new Store(join(dir,'demo.sqlite'));
 const credentials=JSON.parse(readFileSync(join(dir,'demo-credentials.json'),'utf8'));
 return {dir,store,credentials,close(){store.close();rmSync(dir,{recursive:true,force:true});}};
}
