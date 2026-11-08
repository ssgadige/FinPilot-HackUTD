import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import nextEnv from '@next/env';
// Match Next.js precedence before deciding whether a new secret is needed.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production');
if(process.env.OTP_HMAC_SECRET && process.env.OTP_HMAC_SECRET.length < 32)
  throw Error('Configured OTP_HMAC_SECRET is too short. Existing configuration was preserved; supply at least 32 characters.');
if(process.env.OTP_HMAC_SECRET?.length >= 32) {
  console.log('Using server configuration from the environment.');
} else try {
  const defaults={APP_URL:'http://127.0.0.1:3000',ALLOW_LOCAL_HTTP:'true',DEMO_MODE:'true',DATABASE_PATH:'./data/finpilot-demo.sqlite',SMTP_HOST:'127.0.0.1',SMTP_PORT:'1025',SMTP_SECURE:'false',SMTP_FROM:'FinPilot Demo <security@finpilot.test>'};
  // Only fill absent values: existing .env/provider settings must not be masked.
  const lines=Object.entries(defaults).filter(([name])=>!process.env[name]).map(([name,value])=>`${name}=${value}`);
  lines.push(`OTP_HMAC_SECRET=${randomBytes(32).toString('hex')}`,'# Configure NVIDIA_API_KEY and NEMOTRON_MODEL here or in .env.','');
  writeFileSync('.env.local',lines.join('\n'),{flag:'wx',mode:0o600});
  console.log('Created private .env.local; configure provider credentials locally.');
} catch(error) { if(error.code==='EEXIST')console.log('.env.local exists; preserved existing configuration.');else throw error; }
