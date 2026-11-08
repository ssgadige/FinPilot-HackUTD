"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { CoachDraft } from "./coach-panel";
export function MessageComposer({ busy, blocked, onSend, draft }: {
  busy: boolean; blocked: boolean; onSend: (text: string) => void; draft?: CoachDraft;
}) {
  const [text, setText] = useState(draft?.text ?? "");
  const input = useRef<HTMLTextAreaElement>(null);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && !blocked) input.current?.focus();
    wasBusy.current = busy;
  }, [busy, blocked]);
  function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (busy || blocked || !message || message.length > 2000) return;
    onSend(message); setText("");
  }
  return (
    <form className="coach-composer" onSubmit={submit}>
      <label htmlFor="coach-message">Ask FinPilot</label>
      <textarea id="coach-message" ref={input} value={text} rows={3} maxLength={2000}
        placeholder="Explain a finding or ask about your financial overview"
        aria-describedby="coach-input-help coach-input-count" disabled={busy || blocked}
        onChange={event => setText(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
        }} />
      <div className="coach-composer-footer">
        <p id="coach-input-help" className="small muted">Enter to send · Shift+Enter for a new line. Never share passwords or verification codes.</p>
        <span id="coach-input-count" className="small muted">{text.length}/2,000</span>
        <Button type="submit" disabled={busy || blocked || !text.trim()}>{busy ? "Sending…" : "Send message"}</Button>
      </div>
    </form>
  );
}
