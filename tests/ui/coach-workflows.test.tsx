import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { CoachPanel } from "@/components/chat/coach-panel";
import { RunCard } from "@/components/chat/run-card";
import { runsApi } from "@/lib/runs-api";

const reply={reply:"Read the verified cash finding.",evidence_ids:["evidence-1"],requested_run_id:null,conversation_id:"conversation-1",source_mode:"fixture",inference_source_mode:"cached"};
const evidence={id:"evidence-1",run_id:"run-1",kind:"calculation",source_id:"forecast_cash",source_mode:"fixture",observed_at:"2026-11-08T12:00:00Z",snapshot_version:1,
  payload_json:JSON.stringify({data:{balance_cents:50000,date:"2026-11-10",note:'<img src=x onerror="alert(1)">'},assumptions:["Selected checking account; scheduled bills only."]})};
const completed={run_id:"run-1",status:"completed",snapshot_version:1,stale:false,partial:true,model_calls:12,source_mode:"fixture",inference_source_mode:"cached",error_code:null,
  role_steps:[{role:"data-integrity",status:"completed",depends_on:[]},{role:"cash-collision",status:"completed",depends_on:["data-integrity"]},{role:"goal-allocator",status:"skipped",reason:"Required funding metadata is unavailable.",depends_on:["debt-readiness"]}],
  findings:[{id:"cash",severity:"warning",summary:"Checking requires review.",amount_cents:50000,evidence_ids:["evidence-1"]}],trace:[{tool:"forecast_cash",evidence_ids:["evidence-1"],source_modes:["fixture"]}]};
const event=(id:string,type="tool_completed")=>({id,run_id:"run-1",agent_id:"cash-collision",type,message:"forecast_cash",at:"2026-11-08T12:00:00Z"});
const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json",...headers}});
type Handler=(url:string,init:RequestInit)=>Promise<Response>|Response;
let handler:Handler;let fetchMock:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{configurable:true,value(){this.setAttribute("open","");}});
  Object.defineProperty(HTMLDialogElement.prototype,"close",{configurable:true,value(){this.removeAttribute("open");}});
  handler=(url,init)=>{
    if(url==="/api/v1/me")return json({id:"user-1",display_name:"Demo",email:"demo@example.test"},200,{"X-CSRF-Token":"csrf"});
    if(url==="/api/v1/chat")return json(reply);
    if(url.startsWith('/api/v1/evidence/'))return json(evidence);
    if(url==="/api/v1/runs"&&init.method==='POST')return json({run_id:"run-1",status:"queued",snapshot_version:1},202);
    if(url.includes('/events?'))return json({items:[event("event-1")],next_cursor:"1",has_more:false,stale:false});
    if(url.endsWith('/cancel'))return json({run_id:"run-1",status:"cancelled"});
    if(url==="/api/v1/runs/run-1")return json(completed);
    return json({},404);
  };
  fetchMock=vi.fn((url:string,init:RequestInit={})=>handler(url,init));vi.stubGlobal('fetch',fetchMock);
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function Controls(){const {clearSession}=useAuth();return <button onClick={clearSession}>Test logout</button>;}
async function mount(){render(<AuthProvider><CoachPanel/><Controls/></AuthProvider>);await screen.findByLabelText('Ask FinPilot');}
const posts=()=>fetchMock.mock.calls.filter(([url,init])=>url==='/api/v1/runs'&&init.method==='POST');
const callbacks=()=>({onExpired:vi.fn(),onState:vi.fn(),onStale:vi.fn(),onEvidence:vi.fn()});

 describe('CHAT-03 evidence',()=>{
  it('opens real evidence references, shows source facts/assumptions safely and returns focus',async()=>{
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));
    const opener=await screen.findByRole('button',{name:'Inspect answer source 1'});await userEvent.click(opener);
    const drawer=await screen.findByRole('dialog',{name:'Finding evidence'});
    expect(await within(drawer).findByText('$500.00')).toBeInTheDocument();expect(within(drawer).getByText('Selected checking account; scheduled bills only.')).toBeInTheDocument();
    expect(within(drawer).getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();expect(within(drawer).queryByRole('img')).not.toBeInTheDocument();
    fireEvent(drawer,new Event('cancel',{bubbles:false,cancelable:true}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(opener).toHaveFocus();expect(posts()).toHaveLength(0);
  });
  it('asks about the owned finding without starting a new run',async()=>{
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));
    await userEvent.click(await screen.findByRole('button',{name:'Inspect answer source 1'}));
    await userEvent.click(await screen.findByRole('button',{name:'Ask about this finding'}));
    await waitFor(()=>expect(fetchMock.mock.calls.filter(([url])=>url==='/api/v1/chat')).toHaveLength(2));
    const body=JSON.parse(fetchMock.mock.calls.filter(([url])=>url==='/api/v1/chat')[1][1].body);
    expect(body.message).toContain('evidence-1');expect(body).not.toHaveProperty('user_id');expect(posts()).toHaveLength(0);
  });
  it('hides stale/inaccessible evidence and previously displayed financial answers',async()=>{
    const base=handler;let available=true;handler=(url,init)=>url.startsWith('/api/v1/evidence/')&&!available?json({},404):base(url,init);
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));
    await userEvent.click(await screen.findByRole('button',{name:'Inspect answer source 1'}));await screen.findByText('$500.00');
    available=false;fireEvent(window,new Event('focus'));
    await screen.findByText('Evidence unavailable');expect(screen.queryByText('$500.00')).not.toBeInTheDocument();expect(screen.queryByText(reply.reply)).not.toBeInTheDocument();
    expect(screen.getByText(/previous answer is hidden/)).toBeInTheDocument();
  });
  it('links evidence to its originating persisted run',async()=>{
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));
    await userEvent.click(await screen.findByRole('button',{name:'Inspect answer source 1'}));
    await userEvent.click(await screen.findByRole('button',{name:'View originating run'}));
    await screen.findByText('Checking requires review.');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(posts()).toHaveLength(0);
  });
});

describe('CHAT-04 checkups',()=>{
  it('starts only explicitly, deduplicates clicks, and renders honest partial role outcomes',async()=>{
    let release!:(response:Response)=>void;const base=handler;
    handler=(url,init)=>url==='/api/v1/runs'&&init.method==='POST'?new Promise<Response>(r=>release=r):base(url,init);
    await mount();expect(posts()).toHaveLength(0);const button=screen.getByRole('button',{name:'Run financial checkup'});
    fireEvent.click(button);fireEvent.click(button);expect(posts()).toHaveLength(1);
    expect(screen.getByRole('button',{name:'Requesting checkup…'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Send message'})).toBeDisabled();
    expect(screen.queryByText('FinPilot is preparing your response…')).not.toBeInTheDocument();
    await act(async()=>release(json({run_id:'run-1',status:'queued',snapshot_version:1},202)));
    await screen.findByText('Checking requires review.');expect(screen.getByText(/Partial results/)).toBeInTheDocument();expect(screen.getByText('skipped')).toBeInTheDocument();
    const body=JSON.parse(posts()[0][1].body);expect(body.intent).toBe('full');expect(body.idempotency_key).toBeTruthy();expect(body).not.toHaveProperty('user_id');expect(posts()[0][1].headers['X-CSRF-Token']).toBe('csrf');
  });
  it('retries an ambiguous create with the same key rather than making duplicate runs',async()=>{
    const base=handler;let attempts=0;handler=(url,init)=>{
      if(url==='/api/v1/runs'&&init.method==='POST'&&++attempts===1)throw new Error('ambiguous connection loss');
      return base(url,init);
    };
    await mount();await userEvent.click(screen.getByRole('button',{name:'Run financial checkup'}));
    await screen.findByRole('alert');expect(posts()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button',{name:'Retry same checkup request'}));await screen.findByText('Checking requires review.');
    expect(posts()).toHaveLength(2);expect(JSON.parse(posts()[0][1].body).idempotency_key).toBe(JSON.parse(posts()[1][1].body).idempotency_key);
  });
  it('attaches chat-requested run IDs without issuing a second POST /runs',async()=>{
    const base=handler;handler=(url,init)=>url==='/api/v1/chat'?json({...reply,requested_run_id:'run-1'}):base(url,init);
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));
    await screen.findByText('Checking requires review.');expect(screen.getByRole('button',{name:'View requested checkup'})).toBeInTheDocument();expect(posts()).toHaveLength(0);
  });
  it('polls incrementally, deduplicates event IDs and stops after the terminal page',async()=>{
    vi.useFakeTimers();let reads=0;
    handler=(url)=>{
      if(url.includes('/events?'))return json({items:reads<=1?[event('event-1')]:[event('event-1'),event('event-2','completed')],next_cursor:reads<=1?'1':'2',has_more:false,stale:false});
      reads++;return json({...completed,status:reads<=1?'running':'completed'});
    };
    render(<RunCard id='run-1' csrfToken='csrf' {...callbacks()}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(0);});expect(reads).toBe(1);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(reads).toBe(2);
    expect(fetchMock.mock.calls.some(([url])=>url.endsWith('cursor=1'))).toBe(true);
    expect(screen.getByText('Actual activity events (2)')).toBeInTheDocument();
    await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(reads).toBe(2);
  });
  it('confirms cancellation and prevents new polling after the cancelled result',async()=>{
    const base=handler;let cancelled=false;handler=(url,init)=>{
      if(url.endsWith('/cancel')){cancelled=true;return json({run_id:'run-1',status:'cancelled'});}
      if(url==='/api/v1/runs/run-1')return json({...completed,status:cancelled?'cancelled':'running',findings:[]});
      return base(url,init);
    };
    render(<RunCard id='run-1' csrfToken='csrf' {...callbacks()}/>);
    await userEvent.click(await screen.findByRole('button',{name:'Cancel checkup'}));
    await screen.findByText(/Cancellation confirmed/);expect(screen.queryByRole('button',{name:'Cancel checkup'})).not.toBeInTheDocument();
    const call=fetchMock.mock.calls.find(([url])=>url.endsWith('/cancel'))!;expect(call[1]).toMatchObject({method:'POST'});expect(call[1].headers['X-CSRF-Token']).toBe('csrf');
  });
  it('hides stale findings, stops polling and never claims a successful new run',async()=>{
    vi.useFakeTimers();handler=(url)=>url.includes('/events?')?json({items:[],next_cursor:'0',has_more:false,stale:true}):json({...completed,stale:true});
    const cb=callbacks();render(<RunCard id='run-1' csrfToken='csrf' {...cb}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
    expect(screen.getByText(/Old findings and tool results are hidden/)).toBeInTheDocument();expect(screen.queryByText('Checking requires review.')).not.toBeInTheDocument();expect(cb.onStale).toHaveBeenCalled();
    const count=fetchMock.mock.calls.length;await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(fetchMock).toHaveBeenCalledTimes(count);
  });
  it('pauses on rate limits without automatically retrying reads or starting a model run',async()=>{
    vi.useFakeTimers();handler=()=>json({},429,{'Retry-After':'10'});render(<RunCard id='run-1' csrfToken='csrf' {...callbacks()}/>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(0);});expect(screen.getByRole('alert')).toHaveTextContent('Polling paused');expect(screen.getByRole('button',{name:'Refresh activity'})).toBeDisabled();
    const count=fetchMock.mock.calls.length;await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});expect(fetchMock).toHaveBeenCalledTimes(count);expect(posts()).toHaveLength(0);
  });
  it('discards late polling responses after logout',async()=>{
    const base=handler;let release!:(response:Response)=>void;let signal:AbortSignal|undefined;
    handler=(url,init)=>{
      if(url==='/api/v1/runs/run-1'){signal=init.signal as AbortSignal;return new Promise<Response>(r=>release=r);}
      return base(url,init);
    };
    await mount();await userEvent.click(screen.getByRole('button',{name:'Run financial checkup'}));
    await waitFor(()=>expect(release).toBeDefined());await userEvent.click(screen.getByRole('button',{name:'Test logout'}));expect(signal?.aborted).toBe(true);
    await act(async()=>release(json(completed)));expect(screen.queryByText('Checking requires review.')).not.toBeInTheDocument();expect(screen.queryByLabelText('Run activity')).not.toBeInTheDocument();
  });
});

describe('run/evidence wire validation',()=>{
  it.each([{...completed,run_id:'foreign'},{...completed,model_calls:25},{...completed,role_steps:[{role:'execute_sql',status:'completed'}]},{...completed,source_mode:'invented'}])('rejects malformed run responses',async(value)=>{
    handler=()=>json(value);await expect(runsApi.view('run-1')).rejects.toMatchObject({kind:'invalid-response'});
  });
  it('rejects non-advancing pagination and mismatched source IDs',async()=>{
    handler=()=>json({items:[],next_cursor:'0',has_more:true,stale:false});await expect(runsApi.events('run-1')).rejects.toMatchObject({kind:'invalid-response'});
    handler=()=>json({...evidence,id:'foreign'});await expect(runsApi.evidence('evidence-1')).rejects.toMatchObject({kind:'invalid-response'});
  });
});
