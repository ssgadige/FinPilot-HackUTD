import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {AuthProvider} from '@/components/auth/auth-provider';
import {CreditScreen} from '@/components/credit/credit-screen';
import {CoachResponse} from '@/components/chat/coach-response';
import {chatApi,type ChatReply} from '@/lib/chat-api';
const profile={score:684,min:300,max:850,model:'Demonstration score — not FICO or VantageScore',observed_at:'2026-11-07',history:[{month:'2026-10',score:680},{month:'2026-11',score:684}],payment_history:'On-time payments in demo history',credit_history_months:48,recent_inquiries:2,factors:['Review balances'],utilization_bps:2000};
const report=(connected:boolean)=>({connected,available:true,provider:{id:'finpilot-demo-monitor',name:'FinPilot Demo Credit Monitor',mode:'demo'},profile:connected?profile:null,source_mode:'fixture',snapshot_version:2,approval:{status:'unknown',probability:null,explanation:'A score alone cannot establish approval.'}});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('requires monitor consent, displays the report and confirms disconnect without financial execution',async()=>{
  let connected=false;const fetcher=vi.fn(async(path:string,options:RequestInit)=>{
    if(path.endsWith('/me'))return Response.json({id:'a',display_name:'Person A',email:'a@example.test'},{headers:{'X-CSRF-Token':'csrf'}});
    if(options.method==='POST'){expect(JSON.parse(String(options.body))).toEqual({provider_id:'finpilot-demo-monitor',confirmation:true});expect(options.headers).toMatchObject({'X-CSRF-Token':'csrf'});connected=true;}
    if(options.method==='DELETE')connected=false;
    return Response.json(report(connected));
  });vi.stubGlobal('fetch',fetcher);
  render(<AuthProvider><CreditScreen/></AuthProvider>);const user=userEvent.setup();
  const connect=await screen.findByRole('button',{name:'Connect credit monitor'});expect(connect).toBeDisabled();
  await user.click(screen.getByRole('checkbox'));await user.click(connect);
  await screen.findByRole('meter');expect(screen.getByText('Approval estimate: not enough verified information')).toBeVisible();
  expect(screen.getByRole('meter')).toHaveAttribute('value','684');
  await user.click(screen.getByRole('button',{name:'Disconnect monitor'}));expect(connected).toBe(true);
  await user.click(screen.getByRole('button',{name:'Confirm disconnect'}));await screen.findByRole('button',{name:'Connect credit monitor'});expect(screen.queryByRole('meter')).not.toBeInTheDocument();
});
const response:ChatReply={reply:'Legacy flattened reply',conversation_id:'a',evidence_ids:['calc-owned'],requested_run_id:null,source_mode:'fixture',inference_source_mode:'cached',answer:{title:'Your loan estimate',status:'completed',findings:[{id:'info',severity:'info',summary:'A general note.',evidence_ids:['calc-owned'],amount_cents:null},{id:'warning',severity:'warning',summary:'Review the repayment amount.',evidence_ids:['calc-owned'],amount_cents:null}],assumptions:['Fixed rate.'],missing_data:[]},calculations:[{kind:'calculate_loan',data:{payment_cents:100000,total_paid_cents:1200000,interest_cents:0}}],sources:[{provider:'PNC',url:'https://www.pnc.com/en/personal-banking/borrowing/auto-loans.html',category:'auto_loan',availability:'unavailable',retrieved_at:null,terms_status:'Live terms unavailable.'}]};
it('orders findings, formats calculated money and shows only supplied official sources',()=>{
  render(<CoachResponse response={response} text={response.reply}/>);
  const items=within(screen.getByRole('region',{name:'Key findings'})).getAllByRole('listitem');
  expect(items[0]).toHaveTextContent('Review the repayment amount.');expect(screen.getByText('$1,000.00')).toBeVisible();
  expect(screen.queryByText('Legacy flattened reply')).not.toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href',response.sources![0].url);
  expect(screen.getByText('Live terms unavailable — official link only')).toBeVisible();
});
it.each(['javascript:alert(1)','https://www.pnc.com/redirect?to=https://evil.example','https://evil.example/'])('rejects untrusted response source %s before rendering',async url=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({...response,sources:[{...response.sources![0],url}]})));
  await expect(chatApi.send({message:'Find offers.'},{csrfToken:'csrf'})).rejects.toMatchObject({kind:'invalid-response'});
});
it('keeps raw model HTML inert and renders ordinary answers in readable paragraphs',()=>{
  render(<CoachResponse text={'## Summary\n\nFirst paragraph.\n\n- Item one\n- <img src=x onerror=alert(1)>'}/>);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();expect(screen.getAllByRole('listitem')).toHaveLength(2);expect(screen.getByText('First paragraph.')).toBeVisible();
});
