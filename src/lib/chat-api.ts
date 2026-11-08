/** Same-origin chat adapter. Provider credentials and user identity stay on the server. */
import type { SourceMode } from "../../contracts/types";

export type ChatRequest = { message: string; conversation_id?: string };
export type ChatContext = {
  mode: "session_only"; retained_turns: number; max_turns: number; expires_after_seconds: number;
  snapshot_version: number;
  reset: "new_or_expired" | "continued" | "snapshot_changed" | "source_unavailable";
};
export type ChatReply = {
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
  let context:ChatContext|undefined;
  if(value.context!==undefined){
    const c=value.context;
    if(!object(c)||c.mode!=="session_only"||!Number.isSafeInteger(c.retained_turns)||typeof c.retained_turns!=="number"||c.retained_turns<0||c.retained_turns>6||c.max_turns!==6||c.expires_after_seconds!==900||typeof c.snapshot_version!=="number"||!Number.isSafeInteger(c.snapshot_version)||c.snapshot_version<1||!["new_or_expired","continued","snapshot_changed","source_unavailable"].includes(String(c.reset)))
      throw new ChatProblem("invalid-response","The coach returned unexpected conversation context.");
    context={mode:"session_only",retained_turns:c.retained_turns,max_turns:6,expires_after_seconds:900,snapshot_version:c.snapshot_version,reset:c.reset as ChatContext['reset']};
  }
  return {
    reply: value.reply, conversation_id: value.conversation_id,
    evidence_ids: [...new Set(value.evidence_ids)], requested_run_id: value.requested_run_id,
    source_mode: value.source_mode, inference_source_mode: value.inference_source_mode,
    ...(context===undefined?{}:{context}),
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
