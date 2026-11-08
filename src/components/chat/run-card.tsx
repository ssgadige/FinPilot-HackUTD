"use client";
import type { Finding } from "../../../contracts/types";
import { CheckupResults } from "./checkup-results";
import { useEffect, useRef, useState } from "react";
import type { RunEvent } from "../../../contracts/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatProblem } from "@/lib/chat-api";
import { runsApi, type RunStatus, type RunView } from "@/lib/runs-api";
export const roleLabel=(role:string)=>role.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function RunCard({id,csrfToken,onExpired,onState,onStale,onEvidence,onExplain}:{id:string;csrfToken:string|null;onExpired:()=>void;onState:(status:RunStatus|'stale')=>void;onStale:()=>void;onEvidence:(id:string)=>void;onExplain?:(finding:Finding)=>void}){
  const [refresh,setRefresh]=useState(0);
  const [showResults,setShowResults]=useState(false);
  const [result,setResult]=useState<{id:string;generation:number;data?:RunView;error?:string}|null>(null);
  const [events,setEvents]=useState<{id:string;items:RunEvent[]}>({id,items:[]});
  const [cooldown,setCooldown]=useState(0);const cooling=cooldown>0;
  const [cancelling,setCancelling]=useState(false);const [cancelMessage,setCancelMessage]=useState('');
  const cancelRequest=useRef<AbortController|null>(null);
  const history=useRef<{id:string;cursor:string;items:RunEvent[]}>({id,cursor:'0',items:[]});
  useEffect(()=>()=>cancelRequest.current?.abort(),[]);
  useEffect(()=>{if(!cooling)return;const timer=setInterval(()=>setCooldown(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer);},[cooling]);
  useEffect(()=>{
    // Terminal runs do not poll, but consent/snapshot changes must still invalidate them.
    const update=()=>setRefresh(n=>n+1);
    window.addEventListener('focus',update);window.addEventListener('finpilot:finance-invalidated',update);
    return()=>{window.removeEventListener('focus',update);window.removeEventListener('finpilot:finance-invalidated',update);};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    if(history.current.id!==id)history.current={id,cursor:'0',items:[]};
    async function poll(){
      try{
        const [data,page]=await Promise.all([runsApi.view(id,controller.signal),runsApi.events(id,history.current.cursor,controller.signal)]);
        if(controller.signal.aborted)return;
        const seen=new Map(history.current.items.map(e=>[e.id,e]));for(const event of page.items)seen.set(event.id,event);
        history.current={id,cursor:page.next_cursor,items:[...seen.values()].slice(-200)};
        setEvents({id,items:history.current.items});
        const stale=data.stale||page.stale;
        setResult({id,generation:refresh,data:stale?{...data,stale:true,findings:[],trace:[]}:data});
        onState(stale?'stale':data.status);if(stale)onStale();
        if(!stale&&(page.has_more||data.status==='queued'||data.status==='running'))timer=setTimeout(()=>void poll(),page.has_more?200:2000);
      }catch(error){
        if(controller.signal.aborted)return;
        if(error instanceof ChatProblem&&error.kind==='session-expired'){onExpired();return;}
        const message=error instanceof ChatProblem?error.message:'Run activity could not be loaded.';
        setResult({id,generation:refresh,error:message});
        if(error instanceof ChatProblem&&error.kind==='rate-limit')setCooldown(error.retryAfter);
        // Read failures pause polling; they never trigger another model run.
      }
    }
    void poll();return()=>{controller.abort();clearTimeout(timer);};
  },[id,refresh,onExpired,onState,onStale]);
  const current=result?.id===id&&result.generation===refresh?result:null;
  const data=current?.data;const active=data&&!data.stale&&(data.status==='queued'||data.status==='running');
  async function cancel(){
    if(cancelRequest.current||!csrfToken)return;
    const controller=new AbortController();cancelRequest.current=controller;setCancelling(true);setCancelMessage('');
    try{
      const status=await runsApi.cancel(id,csrfToken,controller.signal);
      if(controller.signal.aborted)return;
      setCancelMessage(status==='cancelled'?'Cancellation confirmed. No new tools or model calls will start.':`The run is already ${status}.`);
      onState(status);setRefresh(n=>n+1);
    }catch(error){
      if(controller.signal.aborted)return;
      if(error instanceof ChatProblem&&error.kind==='session-expired'){onExpired();return;}
      setCancelMessage(error instanceof ChatProblem?error.message:'Cancellation could not be confirmed.');
    }finally{if(!controller.signal.aborted){cancelRequest.current=null;setCancelling(false);}}
  }
  return <Card className="coach-run" aria-label="Run activity">
    <div className="coach-section-heading"><h2>Run activity</h2><Button variant="secondary" disabled={!!active||cancelling||cooling} onClick={()=>setRefresh(n=>n+1)}>Refresh activity</Button></div>
    <p className="small muted">Run reference: <code>{id}</code></p>
    {!current&&<p role="status">Loading run activity…</p>}
    {current?.error&&<div role="alert" className="coach-error"><p>{current.error}</p><p>Polling paused. Refreshing reads this run; it does not start another checkup.</p>{cooling&&<p>Refresh available in {cooldown} seconds.</p>}</div>}
    {data&&<>
      <p className="coach-run-status" role="status">Status: <strong>{data.status}</strong>{data.stale?' · Stale snapshot':data.partial?' · Partial results':''}</p>
      <p className="small muted">Snapshot {data.snapshot_version} · Financial data: {data.source_mode==='fixture'?'simulated':data.source_mode} · Inference: {data.inference_source_mode??'not started'} · Model calls: {data.model_calls}/24</p>
      {data.stale?<p role="alert">Financial data changed or account access was revoked. Old findings and tool results are hidden. Request a new checkup for current data.</p>:<>
        {data.status==='failed'&&<p role="alert">The run could not complete safely. No successful analysis or automatic plan acceptance is claimed.</p>}
        {data.partial&&<p>Some specialists failed, were unavailable or need more information. Review each role before using these findings.</p>}
        <h3>Specialist handoffs</h3>
        {data.role_steps.length?<ul className="coach-role-list">{data.role_steps.map(step=><li key={step.role}><strong>{roleLabel(step.role)}</strong><span>{step.status.replaceAll('_',' ')}</span>{step.reason&&<p>{step.reason}</p>}{step.depends_on.length>0&&<p className="small muted">Depends on: {step.depends_on.map(roleLabel).join(', ')}</p>}</li>)}</ul>:<p>No role steps have been returned yet.</p>}
        <h3>Findings</h3>
        {data.findings.length>0&&<Button onClick={()=>setShowResults(true)}>View clear results</Button>}
        {data.findings.length?<ul className="coach-findings">{data.findings.map(f=><li key={f.id}><strong>{f.severity}</strong><p>{f.summary}</p><div className="coach-evidence-links">{f.evidence_ids.map((e,index)=><Button key={e} variant="ghost" onClick={()=>onEvidence(e)}>Inspect finding source {index+1}</Button>)}</div></li>)}</ul>:<p>No supported findings have been returned for this run.</p>}
        {data.trace.length>0&&<details><summary>Validated tool trace ({data.trace.length})</summary><ul>{data.trace.map((t,index)=><li key={index}>{t.tool} · {t.source_modes.join(', ')} · {t.evidence_ids.length} evidence reference(s)</li>)}</ul></details>}
      </>}
      {active&&<Button disabled={cancelling||!csrfToken} variant="secondary" onClick={()=>void cancel()}>{cancelling?'Requesting cancellation…':'Cancel checkup'}</Button>}
    </>}
    {showResults&&data&&!data.stale&&<CheckupResults findings={data.findings} onClose={()=>setShowResults(false)} onExplain={onExplain?f=>{setShowResults(false);onExplain(f);}:undefined} onEvidence={id=>{setShowResults(false);onEvidence(id);}}/>}
    {cancelMessage&&<p role="status">{cancelMessage}</p>}
    {events.id===id&&events.items.length>0&&<details><summary>Actual activity events ({events.items.length}{events.items.length===200?'; most recent 200':''})</summary><ol className="coach-event-list">{events.items.map(e=><li key={e.id}><strong>{roleLabel(e.agent_id)}</strong> · {e.type.replaceAll('_',' ')}<p>{e.message}</p><time dateTime={e.at}>{e.at}</time></li>)}</ol></details>}
  </Card>;
}
