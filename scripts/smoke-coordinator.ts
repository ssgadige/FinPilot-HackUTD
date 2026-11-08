import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { seedPersonas } from './integration/snapshots.ts';
import { runCheckup } from '../src/server/agents/coordinator/index.ts';
import { readConfig } from '../src/server/nemotron/index.ts';
import { RunBudget } from '../src/server/agents/runtime/index.ts';
const dir=mkdtempSync(join(tmpdir(),'fp23-debug-'));let seeds:ReturnType<typeof seedPersonas>|undefined;
try {
  const r=spawnSync('python3',['scripts/seed_demo.py','--database',join(dir,'seed.sqlite')]);if(r.status!==0)throw new Error();
  seeds=seedPersonas(join(dir,'seed.sqlite'));const packet=seeds.load('demo-01','fp23-debug',true);
  const result=await runCheckup({context:packet.context,config:readConfig(),budget:new RunBudget(),intent:'cash',authorize:packet.authorize,toolsFor:packet.toolsFor});
  console.log(JSON.stringify({status:result.coordinator.result.status,model_calls:result.model_calls,steps:result.steps,
    coordinator_failures:result.coordinator.events.filter(e=>e.type==='failed'),
    child_failures:result.results.flatMap(r=>r.events.filter(e=>e.type==='failed')),headline:result.coordinator.result.headline},null,2));
  if(result.coordinator.result.status==='failed')process.exitCode=1;
} catch {console.error('COORDINATOR_SMOKE_FAILED');process.exitCode=1;}
finally{seeds?.close();rmSync(dir,{recursive:true,force:true});}
