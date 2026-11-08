import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Store } from './db';
import { Auth,equal,hash } from './auth';
import { ApiFailure,fail } from './errors';
import { Simulator } from './simulator';
import { Finance } from './finance';
import { Planning } from './planning';
import { Runs } from './runs';
import { Chat } from './chat';
import { date } from './tools/finance';
import { loanCalculation,savingsCalculation } from './tools/finance/calculators';
const key=z.string().min(1).max(128);
const login=z.strictObject({email:z.email().max(254),password:z.string().min(1).max(256)});
const text=z.string().trim().min(1).max(200);
const confirmed=z.literal(true);
const money=z.number().int().min(1).max(100_000_000);
const day=z.string().refine(v=>{try{date(v);return true;}catch{return false;}},'Invalid financial date');
const goal=z.strictObject({title:text,target_cents:money,deadline:day,priority:z.number().int().min(1).max(5)});
const goalPatch=goal.partial().refine(v=>Object.keys(v).length>0);
const scenarios=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('surprise_expense'),expense_cents:money,plan_id:text.optional()}),
 z.strictObject({kind:z.literal('delayed_income'),delay_days:z.number().int().min(1).max(60),plan_id:text.optional()}),
 z.strictObject({kind:z.literal('income_drop'),income_drop_pct:z.number().int().min(1).max(100),plan_id:text.optional()})
]);
const demo=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('surprise_expense'),amount_cents:money,idempotency_key:key}),z.strictObject({kind:z.literal('delayed_income'),days:z.number().int().min(1).max(60),idempotency_key:key})]);
export interface Services {store:Store;auth:Auth;simulator?:Simulator;finance?:Finance;planning?:Planning;runs?:Runs;chat?:Chat;demoMode?:boolean;}
export function createApi(s:Services) {
  return async function handle(request:Request):Promise<Response> {
    const requestId=randomUUID();
    const headers=new Headers({'cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':requestId});
    const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
    const cookie=(name:string,value:string,age:number,httpOnly=true)=> {
      headers.append('set-cookie',`${name}=${value}; Path=/; SameSite=Lax; Max-Age=${age}${httpOnly?'; HttpOnly':''}${s.auth.config.appUrl.startsWith('https:')?'; Secure':''}`);
    };
    const cookies=Object.fromEntries((request.headers.get('cookie')||'').split(';').map(c=>c.trim().split('=')));
    const body=async<T>(schema:z.ZodType<T>):Promise<T>=> {
      if(!request.headers.get('content-type')?.startsWith('application/json')) fail(400,'invalid_input','JSON body required');
      if(Number(request.headers.get('content-length')||0)>16384) fail(400,'invalid_input','Body too large');
      const reader=request.body?.getReader();if(!reader) fail(400,'invalid_input','JSON body required');
      const parts:Uint8Array[]=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>16384){await reader.cancel();fail(400,'invalid_input','Body too large');}parts.push(value);}
      let parsed:unknown;try{parsed=JSON.parse(Buffer.concat(parts).toString());}catch{fail(400,'invalid_input','Invalid JSON');}
      const result=schema.safeParse(parsed);if(!result.success) fail(400,'invalid_input','Invalid request fields');return result.data;
    };
    try {
      const url=new URL(request.url);const path=url.pathname.replace(/^\/api\/v1\/?/,'').split('/').filter(Boolean);const [resource,id,action]=path;
      if(path.length>3) fail(404,'not_found','Route not found');
      const method=request.method;
      if(!['GET','POST','PATCH','DELETE'].includes(method)) fail(405,'method_not_allowed','Method not allowed');
      const unsafe=method!=='GET';if(unsafe)s.auth.protect(request);
      // Untrusted forwarding headers are deliberately ignored. A trusted reverse proxy should supply a validated IP adapter.
      const ip='local-prototype';
      if(resource==='auth'&&method==='POST'&&path.length===2) {
        if(id==='login') {
          const b=await body(login);const result=await s.auth.login(b.email,b.password,ip);
          cookie('fp_pending',result.pending,300);cookie('fp_session','',0);cookie('fp_csrf','',0,false);
          return json({challenge_id:result.challenge_id,masked_email:result.masked_email},202);
        }
        if(id==='verify') {
          s.auth.throttle(`verify-ip:${ip}`,60);
          const b=await body(z.strictObject({challenge_id:key,code:z.string().regex(/^\d{6}$/)}));
          const result=s.auth.verify(b.challenge_id,b.code,cookies.fp_pending||'');
          cookie('fp_pending','',0);cookie('fp_session',result.session,28800);cookie('fp_csrf',result.csrf,28800,false);return json(result.user);
        }
        if(id==='resend') {
          const b=await body(z.strictObject({challenge_id:key}));await s.auth.resend(b.challenge_id,cookies.fp_pending||'');cookie('fp_pending',cookies.fp_pending||'',300);return json({message:'Verification delivery requested'},202);
        }
      }
      const session=s.auth.session(cookies.fp_session||'');const uid=session.user_id as string;
      if(unsafe)s.auth.protect(request,session.csrf_hash || 'invalid-legacy-session');
      // Account-scoped throttle for APIs and provider budgets; GET polling gets a larger window.
      s.auth.throttle(`api:${uid}:${unsafe?'write':'read'}`,unsafe?120:1000,60000);
      if(resource==='auth'&&id==='logout'&&path.length===2&&method==='POST') {
        s.auth.logout(cookies.fp_session||'');cookie('fp_session','',0);cookie('fp_csrf','',0,false);return new Response(null,{status:204,headers});
      }
      if(resource==='me'&&path.length===1&&method==='GET') {
        if(cookies.fp_csrf&&equal(hash(cookies.fp_csrf),session.csrf_hash||''))headers.set('x-csrf-token',cookies.fp_csrf);
        return json(s.auth.profile(uid));
      }
      if(resource==='institutions'&&path.length===1&&method==='GET') {
        const category=url.searchParams.get('category');if(category&&category.length>50)fail(400,'invalid_input','Invalid category');
        return json({items:category?s.store.all('SELECT * FROM institutions WHERE category=?',category):s.store.all('SELECT * FROM institutions ORDER BY name')});
      }
      if(resource==='connections') {
        if(!s.simulator)fail(503,'service_unavailable','Simulator is not configured');
        if(!id&&method==='GET')return json({items:s.simulator.list(uid)});
        if(id==='preview'&&path.length===2&&method==='POST') {
          s.auth.throttle(`simulator:${uid}`,10);
          const b=await body(z.strictObject({institution_id:text,demo_username:text,demo_password:z.string().min(1).max(256)}));return json(s.simulator.preview(uid,b.institution_id,b.demo_username,b.demo_password));
        }
        if(!id&&method==='POST') {
          const b=await body(z.strictObject({preview_token:key,account_ids:z.array(text).min(1).max(20).refine(a=>new Set(a).size===a.length),consent_version:text,idempotency_key:key}));return json(s.simulator.connect(uid,b),201);
        }
        if(id&&action==='sync'&&method==='POST') {const b=await body(z.strictObject({idempotency_key:key}));return json(s.simulator.sync(uid,id,b.idempotency_key));}
        if(id&&!action&&method==='DELETE') {await body(z.strictObject({confirmation:confirmed}));return json(s.simulator.revoke(uid,id));}
      }
      if(['accounts','transactions','overview','forecast','debts','evidence','calculations'].includes(resource)&&!s.finance)fail(503,'service_unavailable','Finance service is not configured');
      if(resource==='accounts'&&path.length===1&&method==='GET')return json({items:s.finance!.accounts(uid,url.searchParams.get('institution_id')||undefined)});
      if(resource==='transactions'&&path.length===1&&method==='GET') {
        const q=z.strictObject({account_id:text.optional(),from:day.optional(),to:day.optional(),category:text.optional(),q:z.string().max(100).optional(),cursor:z.string().max(500).optional(),limit:z.coerce.number().int().min(1).max(200).default(50)}).safeParse(Object.fromEntries(url.searchParams));
        if(!q.success||q.data.from&&q.data.to&&q.data.from>q.data.to)fail(400,'invalid_input','Invalid transaction query');
        return json(s.finance!.transactions(uid,q.data));
      }
      if(resource==='overview'&&path.length===1&&method==='GET')return json(s.finance!.overview(uid));
      if(resource==='forecast'&&path.length===1&&method==='GET') {
        const days=Number(url.searchParams.get('days')||30);if(days!==30&&days!==90)fail(400,'invalid_input','Forecast days must be 30 or 90');
        const result=s.finance!.forecast(uid,days);return json({...result,evidence_ids:[s.finance!.persistCalculation(uid,result,result)]});
      }
      if(resource==='debts'&&path.length===1&&method==='GET')return json({items:s.finance!.debts(uid)});
      if(resource==='evidence'&&id&&path.length===2&&method==='GET')return json(s.store.evidence(uid,id));
      if(['goals','subscriptions','subscription-actions','plans','scenarios'].includes(resource)&&!s.planning)fail(503,'service_unavailable','Planning is not configured');
      if(resource==='goals') {
        if(!id&&method==='GET')return json({items:s.store.all('SELECT * FROM goals WHERE user_id=? ORDER BY priority,id',uid)});
        if(!id&&method==='POST')return json(s.planning!.createGoal(uid,await body(goal)),201);
        if(id&&!action&&method==='GET')return json(s.planning!.goal(uid,id));
        if(id&&!action&&method==='DELETE'){await body(z.strictObject({confirmation:confirmed}));s.planning!.deleteGoal(uid,id);return new Response(null,{status:204,headers});}
        if(id&&!action&&method==='PATCH')return json(s.planning!.updateGoal(uid,id,await body(goalPatch)));
      }
      if(resource==='subscriptions') {
        if(!id&&method==='GET')return json({items:s.store.scoped('subscriptions',uid)});
        if(id&&!action&&method==='PATCH')return json(s.planning!.preferences(uid,id,await body(z.strictObject({usage_confirmed:z.enum(['used','unused','unknown']).optional(),preferences:z.record(z.string().max(50),z.union([z.string().max(200),z.boolean()])).refine(p=>Object.keys(p).length<=20).optional(),confirmation:confirmed}))));
        if(id&&action==='offers'&&method==='GET')return json(await s.planning!.listOffers(uid,id));
      }
      if(resource==='subscription-actions'&&path.length===1&&method==='POST')return json(await s.planning!.action(uid,await body(z.strictObject({subscription_id:text,offer_id:text.optional(),cancel_intention:z.literal(true).optional(),confirmation:confirmed}).refine(b=>Boolean(b.offer_id)!==Boolean(b.cancel_intention)))),201);
      if(resource==='plans') {
        if(!id&&method==='GET')return json({items:s.planning!.list(uid)});
        if(id&&!action&&method==='GET')return json(s.planning!.view(uid,id));
        if(id&&action==='accept'&&method==='POST')return json(s.planning!.accept(uid,id,await body(z.strictObject({expected_version:z.number().int().min(1),confirmation:confirmed,idempotency_key:key}))));
      }
      if(resource==='scenarios'&&path.length===1&&method==='POST') {
        if(!s.finance)fail(503,'service_unavailable','Finance is not configured');
        return json(s.planning!.scenario(uid,await body(scenarios),s.finance),201);
      }
      if(resource==='calculations'&&path.length===1&&method==='POST') {
        const cents=z.number().int().min(0).max(100_000_000);
        const calculationInput=z.discriminatedUnion('kind',[
          z.strictObject({kind:z.literal('loan'),principal_cents:money,apr_bps:z.number().int().min(0).max(10000),months:z.number().int().min(1).max(600),extra_payment_cents:cents}),
          z.strictObject({kind:z.literal('savings'),target_cents:money,saved_cents:cents,months:z.number().int().min(1).max(600),apy_bps:z.number().int().min(0).max(3000)})
        ]);
        const b=await body(calculationInput);
        const result=b.kind==='loan'?loanCalculation(b.principal_cents,b.apr_bps,b.months,b.extra_payment_cents):savingsCalculation(b.target_cents,b.saved_cents,b.months,b.apy_bps);
        return json({...result,evidence_ids:[s.finance!.persistCalculation(uid,result,result)],hypothetical:true},201);
      }

      if(['runs','demo'].includes(resource)&&!s.runs)fail(503,'runtime_unavailable','Run service unavailable');
      if(resource==='chat'&&!s.chat)fail(503,'nemotron_unavailable','Chat unavailable');
      if(resource==='runs') {
        if(!id&&method==='POST') {
          s.auth.throttle(`run:${uid}`,10,3600000);
          const b=await body(z.strictObject({intent:z.enum(['checkup','plan_repair','subscriptions','debt','goals']),goal_id:text.optional(),idempotency_key:key}));if(b.goal_id)s.planning!.goal(uid,b.goal_id);
          // Include validated goal identity in the server-controlled intent; never accept user identity from the body.
          const r=s.runs!.enqueue(uid,b.goal_id?`${b.intent}:goal:${b.goal_id}`:b.intent,b.idempotency_key);return json({run_id:r.id,status:r.status,snapshot_version:r.snapshot_version},202);
        }
        if(id&&!action&&method==='GET')return json(s.runs!.get(uid,id));
        if(id&&action==='events'&&method==='GET')return json(s.runs!.events(uid,id,url.searchParams.get('cursor')||undefined));
        if(id&&action==='cancel'&&method==='POST')return json(s.runs!.cancel(uid,id));
      }
      if(resource==='demo'&&id==='events'&&path.length===2&&method==='POST') {
        if(!s.demoMode)fail(403,'demo_disabled','Demo mode is disabled');
        const b=await body(demo);return json(s.planning!.demoEvent(uid,b,(intent,key)=>s.runs!.enqueue(uid,intent,key,true)),201);
      }
      if(resource==='chat'&&path.length===1&&method==='POST') {
        s.auth.throttle(`chat:${uid}`,10,60000);
        const b=await body(z.strictObject({message:z.string().trim().min(1).max(4000),conversation_id:key.optional()}));
        // Reject common pasted credentials before any model call or persistence.
        if(/(?:Bearer\s+\S+|(?:password|passwd|otp|verification code|api[_ -]?key|session[_ -]?token)\s*[:=]\s*\S+|\b\d{6}\b)/i.test(b.message))fail(400,'sensitive_input','Remove credentials and verification codes before chatting');
        return json(await s.chat!.send(uid,b.message,b.conversation_id));
      }
      fail(404,'not_found','Route not found');
    } catch(error) {
      const e=error instanceof ApiFailure?error:new ApiFailure(500,'internal_error','Request could not be completed');
      return json({error:{code:e.code,message:e.message,request_id:requestId}},e.status);
    }
  };
}
