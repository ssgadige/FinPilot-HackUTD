import { z } from 'zod';
const profile=z.object({score:z.number().int().min(300).max(850),min:z.literal(300),max:z.literal(850),model:z.string(),observed_at:z.string(),history:z.array(z.object({month:z.string(),score:z.number().int().min(300).max(850)})).max(24),payment_history:z.string(),credit_history_months:z.number().int(),recent_inquiries:z.number().int(),factors:z.array(z.string()).max(10),utilization_bps:z.number().int().nullable()});
const schema=z.object({connected:z.boolean(),available:z.boolean(),provider:z.object({id:z.string(),name:z.string(),mode:z.literal('demo')}),profile:profile.nullable(),source_mode:z.literal('fixture'),snapshot_version:z.number().int().positive(),approval:z.object({status:z.literal('unknown'),probability:z.null(),explanation:z.string()})});
export type CreditReport=z.infer<typeof schema>;
export class CreditProblem extends Error {constructor(public status:number){super(status===401?'Your session expired. Sign in again.':status===403?'Refresh your session before continuing.':'Credit information could not be loaded. Please try again.');}}
export async function creditRequest(method:'GET'|'POST'|'DELETE',csrf:string|null,signal:AbortSignal) {
  if(method!=='GET'&&!csrf)throw new CreditProblem(403);
  const r=await fetch('/api/v1/credit'+(method==='POST'?'/connect':''),{method,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:{Accept:'application/json',...(method==='GET'?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf!})},...(method==='GET'?{}:{body:JSON.stringify({confirmation:true,...(method==='POST'?{provider_id:'finpilot-demo-monitor'}:{})})})});
  if(!r.ok)throw new CreditProblem(r.status);
  const parsed=schema.safeParse(await r.json());if(!parsed.success)throw new CreditProblem(502);return parsed.data;
}
