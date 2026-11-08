/** Same-origin, owner-scoped run/evidence wire adapter; never receives user identity. */
import type { Finding, RoleId, RunEvent, SourceMode } from "../../contracts/types";
import { ChatProblem } from "./chat-api";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type RoleStep = { role: RoleId; status: string; reason?: string; depends_on: RoleId[] };
export type RunView = {
  run_id: string; status: RunStatus; snapshot_version: number; stale: boolean;
  partial: boolean; model_calls: number; source_mode: SourceMode; inference_source_mode: SourceMode | null;
  role_steps: RoleStep[]; findings: Finding[];
  trace: { tool: string; evidence_ids: string[]; source_modes: SourceMode[] }[];
  error_code: string | null;
};
export type RunEvents = { items: RunEvent[]; next_cursor: string; has_more: boolean; stale: boolean };
export type EvidenceDetail = {
  id: string; run_id: string; kind: "account" | "transaction" | "calculation" | "offer";
  source_id: string; source_mode: SourceMode; observed_at: string; snapshot_version: number;
  data: unknown; assumptions: string[];
};
const roles: RoleId[] = ["coordinator","chat","data-integrity","cash-collision","subscription-detective","deal-scout","debt-readiness","goal-allocator","stress-test","plan-repair"];
const statuses: RunStatus[] = ["queued","running","completed","failed","cancelled"];
const eventTypes = ["queued","started","tool_started","tool_completed","completed","failed","skipped"];
const object = (v: unknown): v is Record<string,unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const text = (v: unknown): v is string => typeof v === "string" && v.length <= 8000;
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const mode = (v: unknown): v is SourceMode => ["live","fixture","cached"].includes(String(v));
const role = (v: unknown): v is RoleId => roles.includes(v as RoleId);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100 && v.every(str);
const cursor = (v: unknown): v is string => typeof v === "string" && /^(0|[1-9]\d{0,14})$/.test(v);
function bad(): never { throw new ChatProblem("invalid-response","The server returned unexpected run or evidence data. Nothing could be displayed safely."); }
function routeId(id: string) { if (!str(id)) bad(); return encodeURIComponent(id); }

async function request(path: string, options: { signal?: AbortSignal; csrfToken?: string | null; body?: unknown; expected?: number } = {}): Promise<unknown> {
  if (options.body !== undefined && !options.csrfToken) throw new ChatProblem("csrf","Refresh your session before requesting or cancelling a checkup.");
  const controller = new AbortController(); const abort = () => controller.abort();
  if (options.signal?.aborted) throw new DOMException("Aborted","AbortError");
  options.signal?.addEventListener("abort",abort,{once:true});
  let timeout = false; const timer = setTimeout(()=>{timeout=true;controller.abort();},15000);
  try {
    const response = await fetch(`/api/v1${path}`,{method:options.body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
      headers:{Accept:"application/json",...(options.body===undefined?{}:{"Content-Type":"application/json","X-CSRF-Token":options.csrfToken!})},
      ...(options.body===undefined?{}:{body:JSON.stringify(options.body)}),signal:controller.signal});
    if(response.status===401)throw new ChatProblem("session-expired","Your session has expired. Sign in again.");
    if(response.status===403)throw new ChatProblem("csrf","Access could not be confirmed. Refresh your session.");
    if(response.status===404)throw new ChatProblem("unavailable","This run or evidence is unavailable. It may be stale or no longer accessible.");
    if(response.status===409)throw new ChatProblem("unavailable","The snapshot or request changed. Refresh before starting a new request.");
    if(response.status===429){const n=Number(response.headers.get("Retry-After")||60);throw new ChatProblem("rate-limit","Request limit reached. Polling is paused; wait before refreshing.",Number.isFinite(n)?Math.max(1,Math.min(86400,n)):60);}
    if(response.status===503)throw new ChatProblem("unavailable","Agent services are unavailable. No successful checkup is claimed.");
    if(response.status!==(options.expected??200))throw new ChatProblem("provider","The run request could not complete. No successful analysis is claimed.");
    const data: unknown = await response.json().catch(bad);
    if(options.signal?.aborted)throw new DOMException("Aborted","AbortError");
    return data;
  }catch(error){
    if(options.signal?.aborted)throw new DOMException("Aborted","AbortError");
    if(timeout)throw new ChatProblem("timeout","The request timed out. Check existing activity before starting another checkup.");
    if(error instanceof ChatProblem)throw error;
    throw new ChatProblem("network","Connection lost. Existing activity is preserved; no request was automatically retried.");
  }finally{clearTimeout(timer);options.signal?.removeEventListener("abort",abort);}
}
function parseRun(data: unknown, id: string): RunView {
  if(!object(data)||data.run_id!==id||!statuses.includes(data.status as RunStatus)||!integer(data.snapshot_version)||typeof data.stale!=="boolean"||typeof data.partial!=="boolean"||!integer(data.model_calls)||data.model_calls>24||!mode(data.source_mode)||!(data.inference_source_mode===null||mode(data.inference_source_mode))||!(data.error_code===null||str(data.error_code)))bad();
  if(!Array.isArray(data.role_steps)||data.role_steps.length>10||!Array.isArray(data.findings)||data.findings.length>1000||!Array.isArray(data.trace)||data.trace.length>100)bad();
  const steps: RoleStep[]=data.role_steps.map((s:unknown)=>{
    if(!object(s))return bad();const name=s.role??s.agent_id;
    if(!role(name)||![...statuses,"needs_information","skipped"].includes(String(s.status))||(s.reason!==undefined&&!text(s.reason))||(s.depends_on!==undefined&&(!Array.isArray(s.depends_on)||!s.depends_on.every(role))))bad();
    return {role:name,status:String(s.status),...(s.reason===undefined?{}:{reason:s.reason as string}),depends_on:(s.depends_on??[]) as RoleId[]};
  });
  const findings: Finding[]=data.findings.map((f:unknown)=>{
    if(!object(f)||!str(f.id)||!text(f.summary)||!["info","opportunity","warning","urgent"].includes(String(f.severity))||!strings(f.evidence_ids)||!(f.amount_cents===null||(typeof f.amount_cents==="number"&&Number.isSafeInteger(f.amount_cents))))return bad();
    return {id:f.id,summary:f.summary,severity:f.severity as Finding["severity"],evidence_ids:f.evidence_ids,amount_cents:f.amount_cents as number|null};
  });
  const trace: RunView["trace"]=data.trace.map((t:unknown)=>{
    if(!object(t)||!str(t.tool)||!strings(t.evidence_ids)||!Array.isArray(t.source_modes)||!t.source_modes.every(mode))return bad();
    return {tool:t.tool,evidence_ids:t.evidence_ids,source_modes:t.source_modes};
  });
  return {run_id:id,status:data.status as RunStatus,snapshot_version:data.snapshot_version,stale:data.stale,partial:data.partial,model_calls:data.model_calls,
    source_mode:data.source_mode,inference_source_mode:data.inference_source_mode as SourceMode|null,role_steps:steps,findings:data.stale?[]:findings,trace:data.stale?[]:trace,error_code:data.error_code as string|null};
}
export const runsApi = {
  async start(idempotencyKey:string,csrfToken:string|null,signal?:AbortSignal):Promise<{run_id:string;status:RunStatus;snapshot_version:number}> {
    const data=await request("/runs",{body:{intent:"full",idempotency_key:idempotencyKey},csrfToken,signal,expected:202});
    if(!object(data)||!str(data.run_id)||!statuses.includes(data.status as RunStatus)||!integer(data.snapshot_version))return bad();
    return {run_id:data.run_id,status:data.status as RunStatus,snapshot_version:data.snapshot_version};
  },
  async view(id:string,signal?:AbortSignal){return parseRun(await request(`/runs/${routeId(id)}`,{signal}),id);},
  async events(id:string,after="0",signal?:AbortSignal):Promise<RunEvents>{
    if(!cursor(after))bad();const data=await request(`/runs/${routeId(id)}/events?cursor=${encodeURIComponent(after)}`,{signal});
    if(!object(data)||!cursor(data.next_cursor)||typeof data.has_more!=="boolean"||typeof data.stale!=="boolean"||!Array.isArray(data.items)||data.items.length>200||BigInt(data.next_cursor)<BigInt(after)||(data.has_more&&data.next_cursor===after))return bad();
    const items: RunEvent[]=data.items.map((e:unknown)=>{
      if(!object(e)||!str(e.id)||e.run_id!==id||!role(e.agent_id)||!eventTypes.includes(String(e.type))||!text(e.message)||typeof e.at!=="string"||!Number.isFinite(Date.parse(e.at)))return bad();
      return {id:e.id,run_id:id,agent_id:e.agent_id,type:e.type as RunEvent["type"],message:e.message,at:e.at};
    });
    return {items,next_cursor:data.next_cursor,has_more:data.has_more,stale:data.stale};
  },
  async cancel(id:string,csrfToken:string|null,signal?:AbortSignal):Promise<RunStatus>{
    const data=await request(`/runs/${routeId(id)}/cancel`,{body:{},csrfToken,signal});
    if(!object(data)||data.run_id!==id||!statuses.includes(data.status as RunStatus))return bad();return data.status as RunStatus;
  },
  async evidence(id:string,signal?:AbortSignal):Promise<EvidenceDetail>{
    const e=await request(`/evidence/${routeId(id)}`,{signal});
    if(!object(e)||e.id!==id||!str(e.run_id)||!["account","transaction","calculation","offer"].includes(String(e.kind))||!str(e.source_id)||!mode(e.source_mode)||typeof e.observed_at!=="string"||!Number.isFinite(Date.parse(e.observed_at))||!integer(e.snapshot_version)||typeof e.payload_json!=="string"||e.payload_json.length>1_048_576)return bad();
    let payload:unknown;try{payload=JSON.parse(e.payload_json);}catch{return bad();}
    const assumptions=object(payload)&&Array.isArray(payload.assumptions)&&payload.assumptions.every(text)?payload.assumptions as string[]:[];
    return {id,run_id:e.run_id,kind:e.kind as EvidenceDetail["kind"],source_id:e.source_id,source_mode:e.source_mode,observed_at:e.observed_at,snapshot_version:e.snapshot_version,
      data:object(payload)&&Object.hasOwn(payload,"data")?payload.data:payload,assumptions};
  },
};
