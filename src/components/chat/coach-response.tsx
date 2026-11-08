"use client";
import type { ChatReply } from '@/lib/chat-api';

/** Plain React text only: no model HTML, arbitrary links or raw object dumps. */
export function ReadableText({text}:{text:string}) {
  const blocks=text.split(/\n\s*\n/).filter(Boolean);
  return <div className="readable-answer">{blocks.map((block,index)=>{
    const lines=block.split('\n').filter(Boolean);
    if(lines.every(line=>/^\s*(?:[-*•]|\d+[.)])\s+/.test(line)))return <ul key={index}>{lines.map((line,n)=><li key={n}>{line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/,'')}</li>)}</ul>;
    return <div key={index}>{lines.map((line,n)=>/^#{1,4}\s/.test(line)?<p key={n}><strong>{line.replace(/^#{1,4}\s+/,'')}</strong></p>:<p key={n}>{line}</p>)}</div>;
  })}</div>;
}
const severityOrder={urgent:0,warning:1,opportunity:2,info:3};
const currency=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const labels:Record<string,string>={payment_cents:'Base monthly payment',scheduled_payment_cents:'Payment including extra',interest_cents:'Total interest',total_paid_cents:'Total repayment',payoff_months:'Payoff months',contribution_cents:'Monthly savings needed',projected_cents:'Projected savings'};
export function CoachResponse({response,text}:{response?:ChatReply;text:string}) {
  const answer=response?.answer;
  return <div className="coach-answer">
    {answer?<>
      <h3>{answer.title}</h3>
      {answer.status==='needs_information'&&<p className="coach-answer-status">A few details are still needed</p>}
      {!!answer.findings.length&&<section aria-label="Key findings"><h4>What this means for you</h4><ul className="coach-answer-findings">{[...answer.findings].sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]).map(f=><li key={f.id}><ReadableText text={f.summary}/></li>)}</ul></section>}
      {!!answer.missing_data.length&&<section aria-label="Details needed"><h4>To give you a clearer answer</h4><ul>{answer.missing_data.map((item,i)=><li key={i}>{item}</li>)}</ul></section>}
    </>:<ReadableText text={text}/>}
    {response?.calculations?.map((calculation,i)=><section key={i} className="coach-calculation" aria-label="Calculation results"><h4>{calculation.kind==='calculate_loan'?'Your loan estimate':'Your savings estimate'}</h4><dl>{Object.entries(labels).map(([key,label])=>{
      const value=calculation.data[key];return typeof value==='number'?<div key={key}><dt>{label}</dt><dd>{key.endsWith('_cents')?currency(value):value}</dd></div>:null;
    })}</dl><p className="small muted">Hypothetical calculation. Fees, taxes and future rate changes are excluded.</p></section>)}
    {!!response?.sources?.length&&<section className="coach-official-sources" aria-label="Official lender sources"><h4>Official sources to review</h4><p className="small muted">Compare current rates, fees and eligibility with the lender. These links are options, not recommendations or approval.</p>{response.sources.map(source=><article key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.provider} · {source.category.replaceAll('_',' ')} ↗</a><p className="small">{source.availability==='retrieved'?`Retrieved ${new Date(source.retrieved_at!).toLocaleString()}`:'Live terms unavailable — official link only'}</p><p className="small muted">{source.terms_status}</p></article>)}</section>}
    {!!answer?.assumptions.length&&<details><summary>Assumptions &amp; limits</summary><ul>{answer.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul></details>}
  </div>;
}
