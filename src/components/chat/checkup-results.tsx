"use client";
import type { Finding } from '../../../contracts/types';
import { EvidenceDialog } from '@/components/ui/evidence-dialog';
import { Button } from '@/components/ui/button';
import { ReadableText } from './coach-response';
const priority={urgent:0,warning:1,opportunity:2,info:3};
export function CheckupResults({findings,onClose,onExplain,onEvidence}:{findings:Finding[];onClose:()=>void;onExplain?:(finding:Finding)=>void;onEvidence?:(id:string)=>void}) {
  const ordered=[...findings].sort((a,b)=>priority[a.severity]-priority[b.severity]);
  return <EvidenceDialog title="Your checkup results" className="checkup-results-dialog" onClose={onClose}>
    <p className="muted">Start with the items that need attention. Review the source or ask your coach for an explanation.</p>
    <div className="checkup-result-cards">{ordered.map((f,index)=><section key={f.id} className={`checkup-finding checkup-finding--${f.severity}`}><p className="eyebrow">{f.severity==='urgent'?'Needs attention now':f.severity==='warning'?'Worth reviewing':f.severity==='opportunity'?'Opportunity':'For your information'} · {index+1} of {ordered.length}</p><ReadableText text={f.summary}/>{typeof f.amount_cents==='number'&&Number.isSafeInteger(f.amount_cents)&&<p className="checkup-amount">Amount involved: {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(f.amount_cents/100)}</p>}<div className="coach-evidence-links">{onExplain&&<Button disabled={!f.evidence_ids.length} onClick={()=>onExplain(f)}>Explain finding</Button>}{onEvidence&&f.evidence_ids.map((id,i)=><Button key={id} variant="secondary" onClick={()=>onEvidence(id)}>View source {i+1}</Button>)}</div></section>)}</div>
    {!ordered.length&&<p>No supported findings were returned. Review the run status for missing information.</p>}
  </EvidenceDialog>;
}
