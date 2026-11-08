"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useAuth } from "./auth/auth-provider";
import { Button } from "./ui/button";
import { workspaceRequest, WorkspaceProblem } from "@/lib/workspace-api";

export function ChatPopup() {
  const {state,clearSession}=useAuth();
  if(state.status!=="authenticated")return null;
  return <ChatSession key={state.session.profile.id} csrf={state.session.csrfToken} onExpired={clearSession}/>;
}
function ChatSession({csrf,onExpired}:{csrf:string|null;onExpired:()=>void}) {
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [messages,setMessages]=useState<{role:"user"|"assistant";text:string}[]>([]);
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLTextAreaElement>(null);
  const request=useRef<AbortController|null>(null),conversation=useRef<string|undefined>(undefined);
  useEffect(()=>{
    const show=()=>setOpen(true);
    const clear=()=>{request.current?.abort();request.current=null;conversation.current=undefined;setMessages([]);setDraft("");setError("");setBusy(false);};
    window.addEventListener("finpilot:open-chat",show);window.addEventListener("finpilot:finance-invalidated",clear);
    return()=>{request.current?.abort();window.removeEventListener("finpilot:open-chat",show);window.removeEventListener("finpilot:finance-invalidated",clear);};
  },[]);
  useEffect(()=>{if(open){dialog.current?.showModal();input.current?.focus();}else{dialog.current?.close();}},[open]);
  function close(){setOpen(false);trigger.current?.focus();}
  async function submit(event:FormEvent) {
    event.preventDefault();const message=draft.trim();if(!message||request.current)return;
    if(/nvapi-|\b(password|otp|verification code|api key|session token)\b|^\d{6}$/i.test(message)){setError("Please keep passwords and verification codes out of chat.");return;}
    const controller=new AbortController();request.current=controller;setBusy(true);setError("");
    try {
      const data=await workspaceRequest("chat",controller.signal,{method:"POST",csrf,body:{message,...(conversation.current?{conversation_id:conversation.current}:{})}});
      if(controller.signal.aborted)return;
      if(!data||typeof data!=="object"||!("reply" in data)||typeof data.reply!=="string")throw new Error("Unsupported response");
      if("conversation_id" in data&&typeof data.conversation_id==="string")conversation.current=data.conversation_id;
      setMessages(old=>[...old,{role:"user" as const,text:message},{role:"assistant" as const,text:data.reply as string}].slice(-20));setDraft("");
    }catch(failure){if(controller.signal.aborted)return;if(failure instanceof WorkspaceProblem&&failure.status===401){onExpired();return;}setError(failure instanceof WorkspaceProblem&&failure.status===429?"Please wait a moment before trying again.":"The assistant is temporarily unavailable. Your accounts and planning tools are still available.");}
    finally{if(!controller.signal.aborted){request.current=null;setBusy(false);}}
  }
  return <>
    <button ref={trigger} className="chat-launcher" aria-label="Ask FinPilot" aria-haspopup="dialog" onClick={()=>setOpen(true)}><MessageCircle size={22} aria-hidden="true"/><span>Ask FinPilot</span></button>
    <dialog ref={dialog} className="chat-popup" aria-labelledby="chat-popup-title" onCancel={event=>{event.preventDefault();close();}} onClose={()=>{setOpen(false);trigger.current?.focus();}} onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled),a[href]'));
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}
    }}>
      <header className="chat-popup-header"><div><h2 id="chat-popup-title">Your FinPilot assistant</h2><p>Accounts. Insights. Next steps.</p></div><Button variant="ghost" aria-label="Close chat" onClick={close}><X size={20}/></Button></header>
      <div className="chat-messages" role="log" aria-label="Conversation" aria-live="polite">
        {!messages.length&&<div className="chat-welcome"><MessageCircle size={32} aria-hidden="true"/><h3>How can we help?</h3><p>Ask about your spending, accounts or goals.</p></div>}
        {messages.map((message,index)=><p key={index} className={`chat-message chat-message--${message.role}`}><span className="sr-only">{message.role==="user"?"You":"FinPilot"}: </span>{message.text}</p>)}
      </div>
      <form onSubmit={submit} className="chat-composer" aria-busy={busy}>
        {error&&<p role="alert" className="chat-error">{error}</p>}
        <label htmlFor="chat-question" className="sr-only">Message FinPilot</label><textarea ref={input} id="chat-question" placeholder="Ask a question…" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} rows={2} disabled={busy}/>
        <Button type="submit" disabled={busy||!draft.trim()}><Send size={16} aria-hidden="true"/>{busy?"Sending…":"Send"}</Button>
        <p className="small muted">AI guidance may be unavailable. Never share passwords or codes.</p>
      </form>
    </dialog>
  </>;
}
