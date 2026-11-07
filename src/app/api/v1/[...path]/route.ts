import { Store } from '../../../../server/db';
import { Auth, smtpDelivery } from '../../../../server/auth';
import { Simulator } from '../../../../server/simulator';
import { Finance } from '../../../../server/finance';
import { Planning } from '../../../../server/planning';
import { Runs } from '../../../../server/runs';
import { Chat } from '../../../../server/chat';
import { createApi } from '../../../../server/api';
export const runtime='nodejs';
export const dynamic='force-dynamic';
let handler:ReturnType<typeof createApi>|undefined;
async function handle(request:Request) {
  try {
    if(!handler) {
      if(!process.env.OTP_HMAC_SECRET || process.env.OTP_HMAC_SECRET.length<32)throw Error('Configuration unavailable');
      const store=new Store(process.env.DATABASE_PATH || './data/finpilot-demo.sqlite');
      const auth=new Auth(store,{secret:process.env.OTP_HMAC_SECRET||'',appUrl:process.env.APP_URL||'http://localhost:3000',allowLocalHttp:process.env.ALLOW_LOCAL_HTTP==='true'},smtpDelivery());
      handler=createApi({store,auth,simulator:new Simulator(store),finance:new Finance(store),planning:new Planning(store),runs:new Runs(store),chat:new Chat(store),demoMode:process.env.DEMO_MODE==='true'});
    }
    return await handler(request);
  } catch {
    return Response.json({error:{code:'service_unavailable',message:'Backend configuration or database is unavailable',request_id:crypto.randomUUID()}},{status:503,headers:{'cache-control':'no-store'}});
  }
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
