/** Same-origin chat adapter. Provider credentials and user identity stay on the server. */
import { isOfficialOfferUrl } from "./trusted-links";
import type { Finding, SourceMode } from "../../contracts/types";

export type ChatRequest = { message: string; conversation_id?: string };
export type ChatContext = {
  mode: "session_only"; retained_turns: number; max_turns: number; expires_after_seconds: number;
  snapshot_version: number;
  reset: "new_or_expired" | "continued" | "snapshot_changed" | "source_unavailable";
};
export type CoachAnswer={title:string;status:string;findings:Finding[];assumptions:string[];missing_data:string[]};
export type OfficialSource={provider:string;url:string;category:string;availability:'retrieved'|'unavailable';retrieved_at:string|null;terms_status:string};
export type CoachCalculation={kind:'calculate_loan'|'calculate_savings';data:Record<string,unknown>};
export type ChatReply = {
  answer?:CoachAnswer;
  sources?:OfficialSource[];
  calculations?:CoachCalculation[];
  reply: string;
  evidence_ids: string[];
  requested_run_id: string | null;
  conversation_id: string;
  source_mode: SourceMode;
  inference_source_mode: SourceMode;
  context?: ChatContext;
};
export type ChatProblemKind =
  | "invalid-input" | "session-expired" | "csrf" | "rate-limit"
  | "unavailable" | "provider" | "network" | "timeout" | "invalid-response";
export class ChatProblem extends Error {
  constructor(public kind: ChatProblemKind, message: string, public retryAfter = 0) {
    super(message);
    this.name = "ChatProblem";
  }
}
export const CHAT_TIMEOUT_MS = 110_000;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const mode = (value: unknown): value is SourceMode =>
  value === "live" || value === "fixture" || value === "cached";
function retryAfter(value: string | null) {
  const seconds = value && /^\d+$/.test(value)
    ? Number(value) : value ? (Date.parse(value) - Date.now()) / 1000 : 60;
  return Number.isFinite(seconds) ? Math.min(86400, Math.max(1, Math.ceil(seconds))) : 60;
}
function parseReply(value: unknown): ChatReply {
  if (!object(value) || typeof value.reply !== "string" || !value.reply.trim() || value.reply.length > 64000 ||
      !id(value.conversation_id) || !Array.isArray(value.evidence_ids) || value.evidence_ids.length > 100 ||
      !value.evidence_ids.every(id) || !(value.requested_run_id === null || id(value.requested_run_id)) ||
      !mode(value.source_mode) || !mode(value.inference_source_mode)) {
    throw new ChatProblem("invalid-response", "The coach returned an unexpected response. No reply could be displayed.");
  }
  const supportedEvidence=value.evidence_ids as string[];
  let context:ChatContext|undefined;
  if(value.context!==undefined){
    const c=value.context;
    if(!object(c)||c.mode!=="session_only"||!Number.isSafeInteger(c.retained_turns)||typeof c.retained_turns!=="number"||c.retained_turns<0||c.retained_turns>6||c.max_turns!==6||c.expires_after_seconds!==900||typeof c.snapshot_version!=="number"||!Number.isSafeInteger(c.snapshot_version)||c.snapshot_version<1||!["new_or_expired","continued","snapshot_changed","source_unavailable"].includes(String(c.reset)))
      throw new ChatProblem("invalid-response","The coach returned unexpected conversation context.");
    context={mode:"session_only",retained_turns:c.retained_turns,max_turns:6,expires_after_seconds:900,snapshot_version:c.snapshot_version,reset:c.reset as ChatContext['reset']};
  }
  let answer:CoachAnswer|undefined;
  const bad=()=>{throw new ChatProblem("invalid-response","The coach returned unsupported result details.");};
  const strings=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=100&&v.every(t=>typeof t==='string'&&t.length<=8000);
  if(value.answer!==undefined){
    const a=value.answer;
    if(!object(a)||typeof a.title!=='string'||a.title.length>8000||!['completed','needs_information','failed','skipped'].includes(String(a.status))||!Array.isArray(a.findings)||a.findings.length>100||!strings(a.assumptions)||!strings(a.missing_data))return bad();
    const findings:Finding[]=a.findings.map(f=>{
      if(!object(f)||!id(f.id)||typeof f.summary!=='string'||f.summary.length>8000||!['urgent','warning','opportunity','info'].includes(String(f.severity))||!Array.isArray(f.evidence_ids)||!f.evidence_ids.every(e=>id(e)&&supportedEvidence.includes(e))||!(f.amount_cents===null||Number.isSafeInteger(f.amount_cents)))return bad();
      return {id:f.id,summary:f.summary,severity:f.severity as Finding['severity'],evidence_ids:f.evidence_ids,amount_cents:f.amount_cents as number|null};
    });
    answer={title:a.title,status:String(a.status),findings,assumptions:a.assumptions,missing_data:a.missing_data};
  }
  let sources:OfficialSource[]|undefined;
  if(value.sources!==undefined){
    if(!Array.isArray(value.sources)||value.sources.length>8)return bad();
    sources=value.sources.map(s=>{if(!object(s)||typeof s.url!=='string'||!isOfficialOfferUrl(s.url)||typeof s.provider!=='string'||s.provider.length>100||typeof s.category!=='string'||!['retrieved','unavailable'].includes(String(s.availability))||typeof s.terms_status!=='string'||s.terms_status.length>2000||!(s.retrieved_at===null||typeof s.retrieved_at==='string'&&Number.isFinite(Date.parse(s.retrieved_at)))||(s.availability==='retrieved'&&s.retrieved_at===null))return bad();return {provider:s.provider,url:s.url,category:s.category,availability:s.availability as OfficialSource['availability'],retrieved_at:s.retrieved_at as string|null,terms_status:s.terms_status};});
  }
  let calculations:CoachCalculation[]|undefined;
  if(value.calculations!==undefined){if(!Array.isArray(value.calculations)||value.calculations.length>2)return bad();calculations=value.calculations.map(c=>{if(!object(c)||!['calculate_loan','calculate_savings'].includes(String(c.kind))||!object(c.data))return bad();return {kind:c.kind as CoachCalculation['kind'],data:c.data};});}
  return {
    reply: value.reply, conversation_id: value.conversation_id,
    evidence_ids: [...new Set(value.evidence_ids)], requested_run_id: value.requested_run_id,
    source_mode: value.source_mode, inference_source_mode: value.inference_source_mode,
    ...(context===undefined?{}:{context}),
    ...(answer?{answer}:{}),...(sources?{sources}:{}),...(calculations?{calculations}:{}),
  };
}

export const chatApi = {
  async send(input: ChatRequest, options: { csrfToken: string | null; signal?: AbortSignal }): Promise<ChatReply> {
    const message = input.message.trim();
    if (!message || message.length > 2000 || (input.conversation_id !== undefined && !id(input.conversation_id)))
      throw new ChatProblem("invalid-input", "Enter a message of 1–2,000 characters.");
    if (!options.csrfToken)
      throw new ChatProblem("csrf", "Refresh your session before sending a message.");
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CHAT_TIMEOUT_MS);
    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": options.csrfToken },
        body: JSON.stringify({ message, ...(input.conversation_id ? { conversation_id: input.conversation_id } : {}) }),
        signal: controller.signal,
      });
      if (response.status === 401) throw new ChatProblem("session-expired", "Your session has expired. Sign in again to continue.");
      if (response.status === 403) throw new ChatProblem("csrf", "Your request could not be confirmed. Refresh your session before continuing.");
      if (response.status === 429) throw new ChatProblem("rate-limit", "The coach is busy or your request limit was reached. Wait before sending again.", retryAfter(response.headers.get("Retry-After")));
      if (response.status === 503) throw new ChatProblem("unavailable", "The financial coach is unavailable. Please try again later.");
      if (response.status === 502) throw new ChatProblem("provider", "The coach could not complete this response. No successful analysis is claimed.");
      if (response.status === 400) throw new ChatProblem("invalid-input", "This message could not be processed. Use 1–2,000 characters and do not include credentials or verification codes.");
      if (response.status === 404 || response.status === 409) throw new ChatProblem("unavailable", "This conversation is no longer available. Start a new conversation.");
      if (response.status !== 200) throw new ChatProblem("unavailable", "The financial coach could not be reached. Please try again later.");
      const value: unknown = await response.json().catch(() => { throw new ChatProblem("invalid-response", "The coach returned an unreadable response."); });
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return parseReply(value);
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (timedOut) throw new ChatProblem("timeout", "The response took too long. The request may have reached the server; it has not been retried.");
      if (error instanceof ChatProblem) throw error;
      throw new ChatProblem("network", "Connection lost. The request may have reached the server; it has not been retried.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  },
};
