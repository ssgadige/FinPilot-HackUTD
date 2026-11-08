import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { smtpDelivery } from '../../src/server/auth';
test('SMTP sends a real message to a local test receiver; no bypass on connection failure',async()=> {
  const original={...process.env};let content='';
  const server=createServer(socket=> {
    socket.write('220 localhost SMTP ready\r\n');let buffer='',inData=false;
    socket.on('data',chunk=> {
      buffer+=chunk.toString();let index;
      while((index=buffer.indexOf('\r\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+2);
        if(inData){if(line==='.') {inData=false;socket.write('250 accepted\r\n');}else content+=line+'\n';continue;}
        if(line.startsWith('EHLO'))socket.write('250 localhost\r\n');
        else if(line==='DATA'){inData=true;socket.write('354 send data\r\n');}
        else if(line==='QUIT'){socket.end('221 bye\r\n');}
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  process.env.SMTP_HOST='127.0.0.1';process.env.SMTP_PORT=String(address.port);delete process.env.SMTP_USER;process.env.SMTP_SECURE='false';process.env.SMTP_ALLOWED_RECIPIENTS='';delete process.env.SMTP_FROM;
  try {
    await smtpDelivery().send('demo@example.test','529384');assert.ok(content.includes('529384'));assert.ok(content.includes('demo@example.test'));
    await smtpDelivery().send('maya.chen@mail.finpilot.test','529384');assert.ok(content.includes('maya.chen@mail.finpilot.test'));assert.ok(content.includes('security@finpilot.test'));
    await assert.rejects(smtpDelivery().send('maya.chen@mail.finpilot.test.attacker.invalid','529384'),{code:'smtp_unavailable'});
    process.env.SMTP_HOST='smtp.example.invalid';await assert.rejects(smtpDelivery().send('maya.chen@mail.finpilot.test','529384'),{code:'smtp_unavailable'});process.env.SMTP_HOST='127.0.0.1';
    await assert.rejects(smtpDelivery().send('invented@real-domain.com','529384'),{code:'smtp_unavailable'});
    delete process.env.SMTP_HOST;await assert.rejects(smtpDelivery().send('demo@example.test','529384'),{code:'smtp_unavailable'});
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));for(const k of Object.keys(process.env))if(!(k in original))delete process.env[k];Object.assign(process.env,original);}
});
