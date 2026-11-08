"use client";

import { useEffect, useRef } from "react";
import type { ChatReply } from "@/lib/chat-api";
import { Button } from "@/components/ui/button";
export type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  delivery?: "pending" | "sent" | "unconfirmed";
  response?: ChatReply;
  stale?: boolean;
};
export function MessageList({ messages, busy, onEvidence, onRun }: { messages: CoachMessage[]; busy: boolean; onEvidence:(id:string)=>void; onRun:(id:string)=>void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" }); }, [messages, busy]);
  return (
    <div className="coach-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
      {messages.length === 0 ? (
        <div className="coach-empty">
          <h3>A little clarity for your next move</h3>
          <p>Ask about your overview, upcoming bills or saved findings. FinPilot uses your selected simulated accounts.</p>
        </div>
      ) : messages.map(message => (
        <article key={message.id} className={`coach-message coach-message--${message.role}`} aria-label={message.role === "user" ? "Your message" : "FinPilot reply"}>
          <p className="coach-speaker">{message.role === "user" ? "You" : "FinPilot"}</p>
          <p className="coach-message-text">{message.stale?"This previous answer is hidden because its financial snapshot is outdated or inaccessible.":message.content}</p>
          {message.stale && <p className="coach-stale">This answer refers to an older or inaccessible snapshot. Ask for an updated explanation before using its amounts.</p>}
          {message.delivery === "unconfirmed" && <p className="small muted">Response not confirmed. This message was not automatically resent.</p>}
          {message.response && (
            <div className="coach-message-meta">
              <p className="small muted">
                Financial data: {message.response.source_mode === "fixture" ? "simulated" : message.response.source_mode}
                {" · "}Inference: {message.response.inference_source_mode}
              </p>
              {!message.stale && <div className="coach-evidence-links">{message.response.evidence_ids.map((id,index)=><Button key={id} variant="ghost" onClick={()=>onEvidence(id)}>Inspect answer source {index+1}</Button>)}</div>}
              {message.response.requested_run_id && (
                <Button variant="secondary" onClick={()=>onRun(message.response!.requested_run_id!)}>View requested checkup</Button>
              )}
            </div>
          )}
        </article>
      ))}
      {busy && <p className="coach-pending" role="status">FinPilot is preparing your response…</p>}
      <div ref={end} />
    </div>
  );
}
