"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import "@/components/finance/finance.css";
/** Shared native drawer for account, transaction and calculated agent evidence. */
export function EvidenceDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{
    const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const node=dialog.current;node?.showModal();
    return ()=>{node?.close();if(opener?.isConnected)opener.focus();};
  },[]);
  return <dialog ref={dialog} className="evidence-drawer" aria-labelledby={titleId}
    onCancel={event=>{event.preventDefault();onClose();}}
    onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(node=>!node.hidden);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}>
    <header className="finance-toolbar"><div><p className="eyebrow">Source record</p><h2 id={titleId}>{title}</h2></div><Button onClick={onClose} autoFocus>Close evidence</Button></header>
    {children}
  </dialog>;
}
