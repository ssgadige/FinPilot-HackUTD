import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if(process.env.OTP_HMAC_SECRET?.length >= 32) {
  console.log('Using server configuration from the environment.');
} else try {
  writeFileSync('.env.local', `APP_URL=http://localhost:3000\nALLOW_LOCAL_HTTP=true\nDEMO_MODE=true\nDATABASE_PATH=./data/finpilot-demo.sqlite\nOTP_HMAC_SECRET=${randomBytes(32).toString('hex')}\nSMTP_HOST=127.0.0.1\nSMTP_PORT=1025\nSMTP_FROM=finpilot@example.test\nNVIDIA_API_KEY=\nNEMOTRON_MODEL=\n`,{flag:'wx',mode:0o600});
  console.log('Created private .env.local; configure provider credentials locally.');
} catch(error) { if(error.code==='EEXIST')console.log('.env.local exists; preserved existing configuration.');else throw error; }
