import { Store } from './db';
import { Auth,smtpDelivery } from './auth';
import type { Services } from './api';
import { Simulator } from './simulator';
import { Finance } from './finance';
import { Planning } from './planning';
const state=globalThis as typeof globalThis & {finpilotServices?:Services};
export function getServices():Services {
 if(state.finpilotServices)return state.finpilotServices;
 if(!process.env.OTP_HMAC_SECRET||process.env.OTP_HMAC_SECRET.length<32)throw Error('Backend configuration unavailable');
 const store=new Store(process.env.DATABASE_PATH||'./data/finpilot-demo.sqlite');
 try {
  const auth=new Auth(store,{secret:process.env.OTP_HMAC_SECRET,appUrl:process.env.APP_URL||'http://localhost:3000',allowLocalHttp:process.env.ALLOW_LOCAL_HTTP==='true'},smtpDelivery());
  return state.finpilotServices={store,auth,simulator:new Simulator(store),finance:new Finance(store),planning:new Planning(store)};
 }catch(error){store.close();throw error;}
}
