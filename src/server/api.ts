import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Store } from './db';
import { Auth,equal,hash } from './auth';
import { ApiFailure,fail } from './errors';
const key=z.string().min(1).max(128);
const login=z.strictObject({email:z.email().max(254),password:z.string().min(1).max(256)});
export interface Services {store:Store;auth:Auth;}
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

      fail(404,'not_found','Route not found');
    } catch(error) {
      const e=error instanceof ApiFailure?error:new ApiFailure(500,'internal_error','Request could not be completed');
      return json({error:{code:e.code,message:e.message,request_id:requestId}},e.status);
    }
  };
}
