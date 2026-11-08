import assert from 'node:assert/strict';
import { createServer,type Socket } from 'node:net';
import { spawn,execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Store } from '../src/server/db';
async function main() {
  const dir=mkdtempSync(join(tmpdir(),'finpilot-http-')),database=join(dir,'demo.sqlite'),secret=randomBytes(32).toString('hex');
  const sockets=new Set<Socket>();let delivered='';
  const smtp=createServer(socket=>{
    sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.write('220 localhost SMTP ready\r\n');let buffer='',data=false,message='';
    socket.on('data',chunk=>{
      buffer+=chunk.toString();let end;
      while((end=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
        if(data){if(line==='.') {data=false;delivered=/verification code is (\d{6})/.exec(message.replace(/=\r?\n/g,''))?.[1]??'';socket.write('250 accepted\r\n');}else message+=line+'\n';continue;}
        if(line.startsWith('EHLO'))socket.write('250 localhost\r\n');else if(line==='DATA'){data=true;message='';socket.write('354 data\r\n');}else if(line==='QUIT')socket.end('221 bye\r\n');else socket.write('250 OK\r\n');
      }
    });
  });
  let child:ReturnType<typeof spawn>|undefined,log='';const protectedValues=[secret];
  try {
    execFileSync('python3',['scripts/seed_demo.py','--database',database],{stdio:'pipe'});const store=new Store(database);store.close();
    const credentials=JSON.parse(readFileSync(join(dir,'demo-credentials.json'),'utf8')),credential=credentials[0];for(const c of credentials)protectedValues.push(c.app_password,...c.institutions.map((i:{password:string})=>i.password));
    await new Promise<void>(resolve=>smtp.listen(0,'127.0.0.1',resolve));const smtpPort=(smtp.address() as {port:number}).port;
    const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=(probe.address() as {port:number}).port;await new Promise<void>(resolve=>probe.close(()=>resolve()));const base='http://127.0.0.1:'+port;
    child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,NODE_ENV:'production',APP_URL:base,DATABASE_PATH:database,OTP_HMAC_SECRET:secret,ALLOW_LOCAL_HTTP:'true',DEMO_MODE:'true',SMTP_HOST:'127.0.0.1',SMTP_PORT:String(smtpPort),NVIDIA_API_KEY:'',NEMOTRON_MODEL:'',OFFERS_MODE:'fixture'},stdio:['ignore','pipe','pipe']});
    child.stdout!.on('data',chunk=>log+=chunk);child.stderr!.on('data',chunk=>log+=chunk);
    let ready=false;for(let n=0;n<200;n++){try{const r=await fetch(base+'/api/v1/me');if(r.status===401){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}assert.ok(ready,'Production server did not become ready');
    const cookies=new Map<string,string>();let csrf='';
    async function api(path:string,method='GET',body?:unknown,extra:Record<string,string>={}) {
      const response=await fetch(base+'/api/v1/'+path,{method,headers:{origin:base,'content-type':'application/json',cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(csrf?{'x-csrf-token':csrf}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
      for(const value of response.headers.getSetCookie()){const [name,token]=value.split(';')[0].split('=');if(token){cookies.set(name,token);protectedValues.push(token);}else cookies.delete(name);}
      const data=response.status===204?null:await response.json();return {status:response.status,data,headers:response.headers};
    }
    assert.equal((await api('overview')).status,401);
    const login=await api('auth/login','POST',{email:credential.email,password:credential.app_password});assert.equal(login.status,202);assert.ok(delivered);assert.equal((await api('me')).status,401);protectedValues.push(delivered);
    assert.equal((await api('auth/verify','POST',{challenge_id:login.data.challenge_id,code:delivered==='000000'?'111111':'000000'})).status,401);
    assert.equal((await api('auth/verify','POST',{challenge_id:login.data.challenge_id,code:delivered})).status,200);
    const me=await api('me');assert.equal(me.status,200);csrf=me.headers.get('x-csrf-token')!;assert.ok(csrf);assert.equal(me.data.id,'demo-01');
    const institution=credential.institutions[0],preview=await api('connections/preview','POST',{institution_id:institution.institution_id,demo_username:institution.username,demo_password:institution.password});assert.equal(preview.status,200);
    const connection=await api('connections','POST',{preview_token:preview.data.preview_token,account_ids:[preview.data.accounts[0].id],consent_version:'v1',idempotency_key:'http-link'});assert.equal(connection.status,201);
    assert.equal((await api('accounts')).data.items.length,1);assert.ok((await api('transactions?limit=2')).data.items.length>0);assert.equal((await api('overview')).data.source_mode,'fixture');
    const forecast=await api('forecast?days=30');assert.equal(forecast.status,200);assert.equal((await api('evidence/'+forecast.data.evidence_ids[0])).status,200);
    assert.equal((await api('goals','POST',{title:'HTTP fixture goal',target_cents:10000,deadline:'2027-12-01',priority:1})).status,201);
    assert.equal((await api('scenarios','POST',{kind:'income_drop',income_drop_pct:20})).status,201);
    const run=await api('runs','POST',{intent:'checkup',idempotency_key:'http-checkup'});assert.equal(run.status,202);
    let status;for(let n=0;n<100;n++){status=await api('runs/'+run.data.run_id);if(status.data.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(status!.data.error_code,'NEMOTRON_UNAVAILABLE');
    assert.equal((await api('chat','POST',{message:'Explain budgeting'})).status,503);
    assert.equal((await api('auth/logout','POST',{}, {origin:'https://attacker.test'})).status,403);
    assert.equal((await api('auth/logout','POST',{}, {'x-csrf-token':'forged'})).status,403);
    assert.equal((await api('connections/'+connection.data.id,'DELETE',{confirmation:true})).status,200);
    assert.equal((await api('evidence/'+forecast.data.evidence_ids[0])).status,404);assert.equal((await api('accounts')).data.items.length,0);
    assert.equal((await api('auth/logout','POST',{})).status,204);assert.equal((await api('me')).status,401);
    for(const value of protectedValues)assert.ok(!log.includes(value),'Private value appeared in server logs');
    console.log(JSON.stringify({status:'passed',transport:'production HTTP + local SMTP',password_then_email:true,csrf_and_ownership:true,finance_source_mode:'fixture',missing_provider:'explicit unavailable',disconnect_and_logout:true,server_log_secret_scan:'passed'}));
  }finally{
    if(child&&child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(resolve=>child!.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(child.exitCode===null)child.kill('SIGKILL');}
    for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>smtp.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});
  }
}
void main().catch(()=>{console.error('Backend HTTP smoke failed; no private request data logged.');process.exitCode=1;});
