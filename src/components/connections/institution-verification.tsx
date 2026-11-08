"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { connectionsApi, connectionProblem, type ConnectionProblem } from "@/lib/connections-api";
import { AccountConsent } from "./account-consent";
import { ConnectionFeedback, useConnectionClock } from "./connection-feedback";
import type { VerifiedInstitutionPreview } from "./types";

export function InstitutionVerification({providerName,providerId,maskedRecipient,challengeId,csrfToken,onStartAgain}: {
  providerName:string;providerId:string;maskedRecipient:string|null;challengeId:string;csrfToken:string|null;onStartAgain:()=>void;
}) {
  const [preview,setPreview]=useState<VerifiedInstitutionPreview|null>(null);
  const [problem,setProblem]=useState<ConnectionProblem|null>(null);
  const [busy,setBusy]=useState(false);
  const [retryAt,setRetryAt]=useState(()=>Date.now()+60000);
  const [message,setMessage]=useState("");
  const controller=useRef<AbortController|null>(null);
  const now=useConnectionClock();
  const wait=Math.max(0,Math.ceil((retryAt-now)/1000));
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function verify(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(controller.current)return;
    const form=event.currentTarget;
    const data=new FormData(form),code=String(data.get("institution_code")||"").replace(/\s/g,"");
    form.reset();data.delete("institution_code");
    if(!/^\d{6}$/.test(code)){setMessage("Enter the six-digit code from the latest institution email.");return;}
    const request=new AbortController();controller.current=request;setBusy(true);setProblem(null);setMessage("");
    try {
      const result=await connectionsApi.verify(challengeId,code,{csrfToken,signal:request.signal});
      if(!request.signal.aborted) {
        if(result.institutionId!==providerId)throw new Error("Unexpected institution");
        setPreview({...result,institutionName:providerName});
      }
    }catch(error){if(!request.signal.aborted)setProblem(connectionProblem(error));}
    finally{if(!request.signal.aborted){controller.current=null;setBusy(false);}}
  }
  async function resend() {
    if(controller.current||wait)return;
    const request=new AbortController();controller.current=request;setBusy(true);setProblem(null);
    try{await connectionsApi.resend(challengeId,{csrfToken,signal:request.signal});if(!request.signal.aborted){setRetryAt(Date.now()+60000);setMessage("A new code was sent. The earlier code is no longer valid.");}}
    catch(error){if(!request.signal.aborted){const failure=connectionProblem(error);setProblem(failure);if(failure.kind==="rate-limit")setRetryAt(Date.now()+failure.retryAfter*1000);}}
    finally{if(!request.signal.aborted){controller.current=null;setBusy(false);}}
  }
  if(preview)return <AccountConsent preview={preview} csrfToken={csrfToken} onStartAgain={onStartAgain}/>;
  return <form className="page-stack" onSubmit={verify} aria-busy={busy}>
    <h3>Verify your institution email</h3>
    <p>{providerName}: a separate code was delivered to <strong>{maskedRecipient}</strong>. It expires in five minutes. No accounts are accessible yet.</p>
    <FormField label="Institution email code" name="institution_code" inputMode="numeric" autoComplete="one-time-code" maxLength={12} required disabled={busy} hint="Paste or type six digits. Codes are single use, with at most five attempts."/>
    <ConnectionFeedback problem={problem}/>
    {message&&<p role="status">{message}</p>}
    <div className="inline-actions"><Button type="submit" disabled={busy}>{busy?"Please wait?":"Verify institution email"}</Button><Button variant="secondary" disabled={busy||wait>0} onClick={resend}>Resend institution code{wait>0?` (${wait}s)`:""}</Button><Button variant="ghost" onClick={onStartAgain} disabled={busy}>Start again</Button></div>
  </form>;
}
