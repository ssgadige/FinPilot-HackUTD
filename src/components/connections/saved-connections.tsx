"use client";
import { useEffect,useState } from "react";
import { connectionsApi,connectionProblem,type Institution } from "@/lib/connections-api";
import { financeApi } from "@/lib/finance-api";
import type { ConfirmedConnection } from "./types";
import { ConnectionManager } from "./connection-manager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export function SavedConnections({providers,csrfToken,onReconnect,refreshKey}:{providers:Institution[];csrfToken:string|null;onReconnect:(p:Institution)=>void;refreshKey:string}) {
 const [rows,setRows]=useState<ConfirmedConnection[]>([]),[error,setError]=useState(""),[retry,setRetry]=useState(0),[loading,setLoading]=useState(true);
 useEffect(()=>{
  const c=new AbortController();
  async function load(){
   try {
    const [connections,accounts]=await Promise.all([connectionsApi.list({signal:c.signal}),financeApi.accounts(c.signal)]);
    if(c.signal.aborted)return;
    setRows(connections.map(row=>({...row,institutionName:providers.find(p=>p.id===row.institutionId)?.name||row.institutionId,accounts:accounts.items.filter(a=>row.accountIds.includes(a.id)).map(a=>({id:a.id,label:a.label,lastFour:a.last_four||""}))})));
    setError("");
   }catch(e){if(!c.signal.aborted){setRows([]);setError(connectionProblem(e).message);}}
   finally{if(!c.signal.aborted)setLoading(false);}
  }
  void load();return()=>c.abort();
 },[providers,refreshKey,retry]);
 return <section className="page-stack" aria-label="Saved connections"><h2>Saved connections</h2>{loading?<p role="status">Loading saved connections?</p>:error?<Card><p role="alert">{error}</p><Button onClick={()=>setRetry(v=>v+1)}>Retry connections</Button></Card>:rows.length?rows.map(row=><ConnectionManager key={row.id} connection={row} csrfToken={csrfToken} onReconnect={()=>{const provider=providers.find(p=>p.id===row.institutionId);if(provider)onReconnect(provider);}}/>):<p>No connected accounts. Verify an institution and choose accounts to get started.</p>}</section>;
}
