"use client";
import { useEffect, useState } from "react";
import { EvidenceDialog } from "@/components/ui/evidence-dialog";
import { DataState } from "@/components/ui/data-state";
import { Button } from "@/components/ui/button";
import { runsApi, type EvidenceDetail } from "@/lib/runs-api";
import { ChatProblem } from "@/lib/chat-api";

function Facts({value,depth=0,name=""}:{value:unknown;depth?:number;name?:string}){
  if(depth>4)return <span>Additional nested details omitted.</span>;
  if(value===null||value===undefined)return <span>Not supplied</span>;
  if(typeof value==="number"&&Number.isSafeInteger(value)&&name.endsWith("_cents"))return <span>{new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100)}</span>;
  if(typeof value!=="object")return <span>{String(value)}</span>;
  const entries=Object.entries(value).filter(([key])=>!['user_id','userId'].includes(key));
  return <dl className="coach-evidence-facts">{entries.slice(0,40).map(([key,v])=><div key={key}><dt>{Array.isArray(value)?`Item ${Number(key)+1}`:key.replaceAll("_"," ")}</dt><dd><Facts value={v} name={key} depth={depth+1}/></dd></div>)}{entries.length>40&&<div><dt>More records</dt><dd>{entries.length-40} additional items omitted from this view.</dd></div>}</dl>;
}
export function AgentEvidenceDrawer({id,onClose,onExpired,onUnavailable,onRun,onExplain,canExplain}:{id:string;onClose:()=>void;onExpired:()=>void;onUnavailable:()=>void;onRun:(id:string)=>void;onExplain:(id:string)=>void;canExplain:boolean}){
  const [result,setResult]=useState<{id:string;data?:EvidenceDetail;error?:string;generation:number}|null>(null);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const update=()=>setRefresh(n=>n+1);
    window.addEventListener('focus',update);window.addEventListener('finpilot:finance-invalidated',update);
    return ()=>{window.removeEventListener('focus',update);window.removeEventListener('finpilot:finance-invalidated',update);};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void runsApi.evidence(id,controller.signal).then(data=>{
      if(!controller.signal.aborted)setResult({id,data,generation:refresh});
    }).catch(error=>{
      if(controller.signal.aborted)return;
      if(error instanceof ChatProblem&&error.kind==='session-expired'){onExpired();return;}
      setResult({id,error:error instanceof ChatProblem?error.message:'Evidence could not be loaded.',generation:refresh});onUnavailable();
    });
    return ()=>controller.abort();
  },[id,refresh,onExpired,onUnavailable]);
  // Never show previous evidence while another source or refresh is in flight.
  const current=result?.id===id&&result.generation===refresh?result:null;
  return <EvidenceDialog title="Finding evidence" onClose={onClose}>
    <p>Read-only source and deterministic calculation details. Access is checked each time evidence is opened or refreshed.</p>
    {!current?<DataState state="loading" title="Checking evidence access"/>:current.error?<DataState state="error" title="Evidence unavailable" action={<Button onClick={()=>{setResult(null);setRefresh(n=>n+1);}}>Refresh evidence</Button>}><p>{current.error}</p><p>Stale, disconnected and inaccessible sources are not shown.</p></DataState>:current.data&&<>
      <dl className="evidence-values"><dt>Source</dt><dd>{current.data.source_id}</dd><dt>Kind</dt><dd>{current.data.kind}</dd><dt>Data mode</dt><dd>{current.data.source_mode==='fixture'?'Simulated / fixture':current.data.source_mode}</dd><dt>Snapshot</dt><dd>{current.data.snapshot_version}</dd><dt>Observed</dt><dd><time dateTime={current.data.observed_at}>{current.data.observed_at}</time></dd><dt>Evidence reference</dt><dd>{current.data.id}</dd></dl>
      <h3>Calculation and source facts</h3><Facts value={current.data.data}/>
      <h3>Assumptions</h3>{current.data.assumptions.length?<ul>{current.data.assumptions.map((a,index)=><li key={index}>{a}</li>)}</ul>:<p>No assumptions were supplied.</p>}
      <Button variant="secondary" onClick={()=>onRun(current.data!.run_id)}>View originating run</Button>
      <Button disabled={!canExplain} onClick={()=>onExplain(id)}>Ask about this finding</Button>
    </>}
  </EvidenceDialog>;
}
