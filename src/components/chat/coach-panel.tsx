"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { chatApi, ChatProblem, type ChatContext } from "@/lib/chat-api";
import { MessageList, type CoachMessage } from "./message-list";
import { MessageComposer } from "./message-composer";
import { AgentEvidenceDrawer } from "./evidence-drawer";
import { RunCard } from "./run-card";
import { runsApi, type RunStatus } from "@/lib/runs-api";
import "./chat.css";

const suggestions = ["Explain my financial overview.", "What bills are coming up?", "Explain my latest checkup findings."];
export type CoachDraft = { id: number; text: string };
export function CoachPanel({ draft, onInspectRun }: { draft?: CoachDraft; onInspectRun?: (id: string) => void } = {}) {
  const { state, clearSession } = useAuth();
  if (state.status !== "authenticated") return <Card><p role="status">Sign in to use your financial coach.</p><Link href="/login">Sign in</Link></Card>;
  // Unmount the entire private transcript immediately on user change or logout.
  return <UserCoach key={state.session.profile.id} csrfToken={state.session.csrfToken} onExpired={clearSession} draft={draft} onInspectRun={onInspectRun} />;
}
function UserCoach({ csrfToken, onExpired, draft, onInspectRun }: { csrfToken: string | null; onExpired: () => void; draft?: CoachDraft; onInspectRun?: (id: string) => void }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [sentDraftId, setSentDraftId] = useState<number>();
  const [conversationId, setConversationId] = useState<string>();
  const [memory,setMemory]=useState<ChatContext>();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ChatProblem | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const [selectedEvidence,setSelectedEvidence]=useState<string|null>(null);
  const selectedEvidenceRef=useRef<string|null>(null);
  const [activeRun,setActiveRun]=useState<string>();
  const [knownRuns,setKnownRuns]=useState<string[]>([]);
  const [activeStatus,setActiveStatus]=useState<RunStatus|'stale'|'loading'>('loading');
  const [starting,setStarting]=useState(false);
  const [startProblem,setStartProblem]=useState<ChatProblem|null>(null);
  const [retryStart,setRetryStart]=useState(false);
  const startRequest=useRef<AbortController|null>(null);
  const startKey=useRef<string|null>(null);
  const runArea=useRef<HTMLDivElement>(null);
  const coolingDown = cooldownSeconds > 0;
  useEffect(() => () => {request.current?.abort();startRequest.current?.abort();}, []);
  useEffect(()=>{runArea.current?.scrollIntoView?.({block:'nearest',behavior:'instant'});},[activeRun]);
  useEffect(()=>{
    const invalidate=()=>{
      setSelectedEvidence(null);selectedEvidenceRef.current=null;
      setMessages(previous=>previous.map(m=>m.response?{...m,stale:true}:m));
    };
    window.addEventListener('finpilot:finance-invalidated',invalidate);
    return()=>window.removeEventListener('finpilot:finance-invalidated',invalidate);
  },[]);
  const openEvidence=useCallback((id:string)=>{selectedEvidenceRef.current=id;setSelectedEvidence(id);},[]);
  const closeEvidence=useCallback(()=>{selectedEvidenceRef.current=null;setSelectedEvidence(null);},[]);
  const unavailableEvidence=useCallback(()=>{
    const id=selectedEvidenceRef.current;
    setMessages(previous=>previous.map(m=>id&&m.response?.evidence_ids.includes(id)?{...m,stale:true}:m));
  },[]);
  const selectRun=useCallback((id:string)=>{
    if(id!==activeRun)setActiveStatus('loading');
    setActiveRun(id);setKnownRuns(previous=>[id,...previous.filter(r=>r!==id)].slice(0,8));
    setSelectedEvidence(null);selectedEvidenceRef.current=null;
  },[activeRun]);
  const staleRun=useCallback(()=>{
    setMessages(previous=>previous.map(m=>m.response?.requested_run_id===activeRun?{...m,stale:true}:m));
  },[activeRun]);
  const runState=useCallback((status:RunStatus|'stale')=>setActiveStatus(status),[]);
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setCooldownSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);
  const blocked = !csrfToken || coolingDown || problem?.kind === "csrf";
  async function send(text: string) {
    if (request.current || startRequest.current || blocked) return;
    const controller = new AbortController(); request.current = controller;
    const id = String(++sequence.current);
    setMessages(previous => [...previous, { id, role: "user" as const, content: text, delivery: "pending" as const }].slice(-40));
    setBusy(true); setProblem(null);
    try {
      const response = await chatApi.send({ message: text, ...(conversationId ? { conversation_id: conversationId } : {}) }, { csrfToken, signal: controller.signal });
      if (controller.signal.aborted) return;
      setConversationId(response.conversation_id);
      setMemory(response.context);
      if(response.requested_run_id){setActiveStatus('loading');selectRun(response.requested_run_id);}
      const changed=response.context?.reset==='snapshot_changed'||response.context?.reset==='source_unavailable'||!!(memory&&response.context&&memory.snapshot_version!==response.context.snapshot_version);
      setMessages(previous => [...previous.map(m => ({...m,...(m.id===id?{delivery:"sent" as const}:{}),...(changed&&m.response?{stale:true}:{})})),
        { id: String(++sequence.current), role: "assistant" as const, content: response.reply, response }].slice(-40));
    } catch (error) {
      if (controller.signal.aborted) return;
      const issue = error instanceof ChatProblem ? error : new ChatProblem("unavailable", "The financial coach is unavailable. Please try again later.");
      if (issue.kind === "session-expired") { onExpired(); return; }
      setProblem(issue);
      setMessages(previous => previous.map(m => m.id === id ? { ...m, delivery: "unconfirmed" } : m));
      if (issue.kind === "rate-limit") setCooldownSeconds(issue.retryAfter);
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }
  function newConversation() {
    request.current?.abort(); request.current = null;
    setBusy(false); setMessages([]); setConversationId(undefined); setProblem(null);setMemory(undefined);
    closeEvidence();
  }
  async function startCheckup(){
    if(startRequest.current||request.current||blocked||(activeRun&&['loading','queued','running'].includes(activeStatus)))return;
    const controller=new AbortController();startRequest.current=controller;setStarting(true);setStartProblem(null);
    try{
      startKey.current??=`coach:${crypto.randomUUID()}`;
      const result=await runsApi.start(startKey.current,csrfToken,controller.signal);
      if(controller.signal.aborted)return;
      setActiveStatus('loading');selectRun(result.run_id);startKey.current=null;setRetryStart(false);
    }catch(error){
      if(controller.signal.aborted)return;
      const issue=error instanceof ChatProblem?error:new ChatProblem('unavailable','The checkup could not be requested.');
      if(issue.kind==='session-expired'){onExpired();return;}
      setStartProblem(issue);setRetryStart(true);
      if(issue.kind==='rate-limit')setCooldownSeconds(issue.retryAfter);
    }finally{if(!controller.signal.aborted){startRequest.current=null;setStarting(false);}}
  }
  return (
    <div className="coach-layout">
      <div className="coach-main">
        <Card className="coach-conversation" aria-labelledby="coach-conversation-title">
          <div className="coach-section-heading">
            <h2 id="coach-conversation-title">Conversation</h2>
            <Button variant="ghost" disabled={busy || starting || messages.length === 0} onClick={newConversation}>New conversation</Button>
          </div>
          <MessageList messages={messages} busy={busy} onEvidence={openEvidence} onRun={selectRun} />
          {messages.length === 0 && <div className="coach-suggestions" aria-label="Suggested questions">
            {suggestions.map(text => <Button key={text} variant="secondary" disabled={busy || starting || blocked} onClick={() => void send(text)}>{text}</Button>)}
          </div>}
        </Card>
        <Card>
          <h2 className="coach-composer-title">Message</h2>
          {!csrfToken && <p role="alert" className="field-error">Session protection is unavailable. Refresh the page before sending a message.</p>}
          {coolingDown && !problem && <p role="status">Try again in {cooldownSeconds} seconds.</p>}
          {problem && <div className="coach-error" role="alert">
            <p>{problem.message}</p>
            {coolingDown && <p>Try again in {cooldownSeconds} seconds.</p>}
            {problem.kind === "csrf" ? <p>Refresh the page to renew your session protection.</p> :
              <p>No automatic retry was made. If you requested a checkup, confirm its activity before requesting another.</p>}
          </div>}
          {draft && draft.id !== sentDraftId && <p className="coach-context-note">A specialist finding is ready in your message. Review it, then send to request an explanation.</p>}
          <MessageComposer key={draft?.id ?? "message"} busy={busy} blocked={blocked||starting} draft={draft} onSend={text => { setSentDraftId(draft?.id); void send(text); }} />
        </Card>
        <Card>
          <h2>Financial checkup</h2>
          <p id="coach-run-help">Request a bounded analysis of your selected accounts. This does not accept a plan or move money.</p>
          <Button aria-describedby="coach-run-help" disabled={busy||starting||blocked||!!(activeRun&&['loading','queued','running'].includes(activeStatus))} onClick={()=>void startCheckup()}>{starting?'Requesting checkup…':retryStart?'Retry same checkup request':'Run financial checkup'}</Button>
          {startProblem&&<div role="alert" className="coach-error"><p>{startProblem.message}</p><p>A retry uses the same request key, so an already queued checkup is not duplicated.</p></div>}
          {knownRuns.length>1&&<div className="coach-evidence-links" aria-label="Recent run references">{knownRuns.map((id,index)=><Button key={id} variant="ghost" onClick={()=>selectRun(id)}>View run {index+1}{id===activeRun?' (selected)':''}</Button>)}</div>}
        </Card>
        {activeRun&&<div ref={runArea}>{onInspectRun && <Button variant="secondary" onClick={() => onInspectRun(activeRun)}>Open specialist dashboard</Button>}<RunCard key={activeRun} id={activeRun} csrfToken={csrfToken} onExpired={onExpired} onState={runState} onStale={staleRun} onEvidence={openEvidence}/></div>}
      </div>
      <aside className="coach-inspector" aria-label="Coach scope and controls">
        <Card><p className="eyebrow">YOUR FINANCIAL COACH</p><h2>Start with a question</h2><p>Read your current overview, explain saved findings and clarify your next question.</p><div className="coach-workflow-links"><Link href="/cash-and-bills">Cash &amp; upcoming bills</Link><Link href="/subscriptions">Recurring costs &amp; offers</Link><Link href="/goals-and-plans">Goals &amp; proposed plans</Link></div></Card>
        <Card><h2>You stay in control</h2><p>A message does not authorize money movement or replace explicit plan acceptance.</p></Card>
        <Card><h2>Conversation context</h2><p>Ask follow-up questions using up to three recent exchanges in this verified session. Financial facts are checked again for every reply.</p>
          <p className="small">Context expires after 15 minutes of inactivity and clears on logout or server restart. A changed financial snapshot starts fresh context.</p>
          {memory&&<p className="small" role="status">Context at last reply: {memory.retained_turns}/{memory.max_turns} messages · Session only</p>}
          {memory?.reset==='new_or_expired'&&messages.length>2&&<p className="coach-stale">Earlier context was unavailable or expired. This reply starts a fresh discussion.</p>}
          {(memory?.reset==='snapshot_changed'||memory?.reset==='source_unavailable')&&<p className="coach-stale">Financial data or source access changed. Previous context was discarded; this reply uses current records.</p>}
        </Card>
        <Card><h2>Connected workflows</h2><p>Open the sources behind an answer, request a checkup and inspect actual role activity. Changed or disconnected records require fresh evidence.</p></Card>
      </aside>
      {selectedEvidence&&<AgentEvidenceDrawer key={selectedEvidence} id={selectedEvidence} onClose={closeEvidence} onExpired={onExpired} onUnavailable={unavailableEvidence} onRun={selectRun} canExplain={!busy&&!starting&&!blocked} onExplain={id=>{closeEvidence();void send(`Explain the current finding supported by evidence ${id}.`);}}/>}
    </div>
  );
}
