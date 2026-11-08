"use client";
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { ShieldCheck,TrendingUp } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { PageHeading } from '@/components/page-heading';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { creditRequest,CreditProblem,type CreditReport } from '@/lib/credit-api';
import './credit.css';

export function CreditScreen() {
  const {state,clearSession}=useAuth();
  if(state.status!=='authenticated')return <p role="status">Checking your verified session…</p>;
  return <PrivateCredit key={state.session.profile.id} csrf={state.session.csrfToken} onExpired={clearSession}/>;
}
function PrivateCredit({csrf,onExpired}:{csrf:string|null;onExpired:()=>void}) {
  const [report,setReport]=useState<CreditReport>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0),[consent,setConsent]=useState(false),[confirmDisconnect,setConfirmDisconnect]=useState(false);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{const c=new AbortController();void creditRequest('GET',null,c.signal).then(d=>{if(!c.signal.aborted)setReport(d);}).catch(e=>{if(c.signal.aborted)return;if(e instanceof CreditProblem&&e.status===401)onExpired();else setError(e instanceof CreditProblem?e.message:'Connection lost. Please try again.');});return()=>c.abort();},[retry,onExpired]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function change(method:'POST'|'DELETE') {
    if(request.current)return;const c=new AbortController();request.current=c;setBusy(true);setError('');
    try {const result=await creditRequest(method,csrf,c.signal);if(c.signal.aborted)return;setReport(result);setConsent(false);setConfirmDisconnect(false);window.dispatchEvent(new Event('finpilot:finance-invalidated'));}
    catch(e){if(c.signal.aborted)return;if(e instanceof CreditProblem&&e.status===401)onExpired();else setError(e instanceof CreditProblem?e.message:'Connection lost. Your change was not confirmed.');}
    finally{if(!c.signal.aborted){request.current=null;setBusy(false);}}
  }
  const p=report?.profile;
  function ask(){window.dispatchEvent(new CustomEvent('finpilot:coach-draft',{detail:{text:'Find current auto loan options from official lenders and explain what my connected credit profile can and cannot tell me about eligibility.'}}));}
  return <div className="page-stack credit-page">
    <PageHeading title="Your credit health" description="Understand your score and prepare for your next application."/>
    {error&&<Card><p role="alert">{error}</p><Button onClick={()=>{setError('');setRetry(v=>v+1);}}>Try again</Button></Card>}
    {!report&&!error&&<p role="status">Loading credit information…</p>}
    {report&&!report.connected&&<Card className="credit-connect"><ShieldCheck size={32} aria-hidden="true"/><h2>Connect your credit monitor</h2><p>View your score, recent changes and factors in one place.</p><p className="small muted">Presentation connection: {report.provider.name}. Fictional credit data; no bureau request or credit pull.</p>{report.available?<><label className="credit-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Allow this monitor’s demo report to appear in my workspace and analysis.</label><Button disabled={!consent||busy||!csrf} onClick={()=>void change('POST')}>{busy?'Connecting…':'Connect credit monitor'}</Button></>:<p>No demo credit profile is available for this account.</p>}</Card>}
    {p&&<>
      <div className="credit-grid"><Card className="credit-score"><p className="eyebrow">YOUR CREDIT SNAPSHOT</p><strong className="credit-score-number">{p.score}<span>/ 850</span></strong><meter min={300} max={850} value={p.score} aria-label="Demo credit score"/><p>{p.model}</p><p className="small muted">Updated {p.observed_at} · {report.provider.name}</p></Card>
      <Card><h2><TrendingUp size={20} aria-hidden="true"/> Your score over time</h2><svg viewBox="0 0 480 150" role="img" aria-label="Twelve-month demonstration credit score trend"><path d="M20 130 H460" stroke="currentColor" opacity=".2"/><polyline points={p.history.map((h,i)=>`${20+i*440/Math.max(1,p.history.length-1)},${130-(h.score-300)*110/550}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/></svg><details><summary>View score history</summary><table><caption>Monthly demonstration scores</caption><thead><tr><th>Month</th><th>Score</th></tr></thead><tbody>{p.history.map(h=><tr key={h.month}><td>{h.month}</td><td>{h.score}</td></tr>)}</tbody></table></details></Card></div>
      <div className="credit-grid"><Card><h2>What shapes this profile</h2><dl className="credit-facts"><dt>Payment history</dt><dd>{p.payment_history}</dd><dt>Credit history</dt><dd>{p.credit_history_months} months</dd><dt>Recent inquiries</dt><dd>{p.recent_inquiries}</dd><dt>Connected-card utilization</dt><dd>{p.utilization_bps===null?'Connect cards with known limits':`${(p.utilization_bps/100).toFixed(1)}%`}</dd></dl><ul>{p.factors.map(f=><li key={f}>{f}</li>)}</ul></Card>
      <Card><h2>Before you apply</h2><p className="credit-unknown">Approval estimate: not enough verified information</p><p>{report.approval.explanation}</p><Button onClick={ask}>Explore loan options with the coach</Button><Link href="/debt-and-readiness">Compare a hypothetical loan payment</Link><a href="https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/understand-your-credit-score/" target="_blank" rel="noopener noreferrer">Learn about credit scores · CFPB ↗</a></Card></div>
      <Card><h2>Monitor connection</h2><p>Disconnecting hides this report from future analysis.</p>{confirmDisconnect?<><p>Disconnect this credit monitor?</p><Button disabled={busy} onClick={()=>void change('DELETE')}>Confirm disconnect</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirmDisconnect(false)}>Keep connected</Button></>:<Button variant="secondary" onClick={()=>setConfirmDisconnect(true)}>Disconnect monitor</Button>}</Card>
    </>}
  </div>;
}
