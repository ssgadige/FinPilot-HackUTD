import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { CoachPanel } from "@/components/chat/coach-panel";
import { chatApi, CHAT_TIMEOUT_MS } from "@/lib/chat-api";

const profile = { id: "user-a", display_name: "Demo User", email: "demo@example.test" };
const reply = { reply: "Review the current cash findings.", evidence_ids: ["calc-owned"], requested_run_id: null,
  conversation_id: "owned-conversation", source_mode: "fixture", inference_source_mode: "live" };
const json = (body: unknown, status = 200, headers: Record<string,string> = {}) => new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json", ...headers}});
let mockFetch: ReturnType<typeof vi.fn>;
let currentProfile = profile;
beforeEach(() => {
  currentProfile = profile;
  mockFetch = vi.fn(async (url: string) => url === "/api/v1/me"
    ? json(currentProfile,200,{"X-CSRF-Token":"session-csrf"}) : json(reply));
  vi.stubGlobal("fetch",mockFetch);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function SessionControls() {
  const { clearSession, refresh } = useAuth();
  return <><button onClick={clearSession}>Test logout</button><button onClick={() => void refresh()}>Test change user</button></>;
}
async function mount() {
  render(<AuthProvider><CoachPanel/><SessionControls/></AuthProvider>);
  await screen.findByLabelText("Ask FinPilot");
}
const chatCalls = () => mockFetch.mock.calls.filter(([url]) => url === "/api/v1/chat");

describe("CHAT-01 browser adapter", () => {
  it("posts only allowed fields with CSRF/cookies and returns the validated contract", async () => {
    const response = await chatApi.send({message:" Explain. ",conversation_id:"existing"},{csrfToken:"csrf"});
    expect(response).toEqual(reply);
    const [url,options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/v1/chat");
    expect(options).toMatchObject({method:"POST",credentials:"same-origin",cache:"no-store",redirect:"error"});
    expect(options.headers["X-CSRF-Token"]).toBe("csrf");
    expect(JSON.parse(options.body)).toEqual({message:"Explain.",conversation_id:"existing"});
  });
  it.each([[401,"session-expired"],[403,"csrf"],[429,"rate-limit"],[502,"provider"],[503,"unavailable"],[500,"unavailable"],[400,"invalid-input"]])("maps HTTP %s without reflecting provider errors",async (status,kind) => {
    mockFetch.mockResolvedValue(json({error:{message:"nvapi-private-provider-body"}},Number(status),{"Retry-After":"12"}));
    await expect(chatApi.send({message:"Explain."},{csrfToken:"csrf"})).rejects.toMatchObject({kind});
    try {await chatApi.send({message:"Explain."},{csrfToken:"csrf"});}catch(error){expect(String(error)).not.toContain("nvapi-private-provider-body");}
  });
  it("honors rate limit delay and rejects missing protection/invalid input without a request", async () => {
    await expect(chatApi.send({message:"Hi"},{csrfToken:null})).rejects.toMatchObject({kind:"csrf"});
    await expect(chatApi.send({message:" "},{csrfToken:"csrf"})).rejects.toMatchObject({kind:"invalid-input"});
    expect(mockFetch).not.toHaveBeenCalled();
    mockFetch.mockResolvedValue(json({},429,{"Retry-After":"23"}));
    await expect(chatApi.send({message:"Hi"},{csrfToken:"csrf"})).rejects.toMatchObject({kind:"rate-limit",retryAfter:23});
  });
  it.each([{...reply,reply:""},{...reply,evidence_ids:[{id:"wrong"}]},{...reply,source_mode:"invented"},{...reply,conversation_id:null},{...reply,requested_run_id:17}])("rejects malformed success bodies", async body => {
    mockFetch.mockResolvedValue(json(body));
    await expect(chatApi.send({message:"Explain."},{csrfToken:"csrf"})).rejects.toMatchObject({kind:"invalid-response"});
  });
  it("does not retry network failures", async () => {
    mockFetch.mockRejectedValue(new Error("private transport details"));
    await expect(chatApi.send({message:"Explain."},{csrfToken:"csrf"})).rejects.toMatchObject({kind:"network"});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it("supports caller cancellation and a bounded deadline without retry", async () => {
    vi.useFakeTimers();
    mockFetch.mockImplementation((_url: string,options:RequestInit) => new Promise((_resolve,reject) => {
      options.signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")),{once:true});
    }));
    const controller = new AbortController();
    const cancelled = chatApi.send({message:"Explain."},{csrfToken:"csrf",signal:controller.signal});
    const cancelCheck = expect(cancelled).rejects.toMatchObject({name:"AbortError"});controller.abort();await cancelCheck;
    const pending=chatApi.send({message:"Explain."},{csrfToken:"csrf"});
    const check=expect(pending).rejects.toMatchObject({kind:"timeout"});
    await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS);await check;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("CHAT-02 coach interface", () => {
  it("uses suggestions, reuses the conversation ID and renders model HTML as text",async () => {
    await mount();const user=userEvent.setup();
    await user.click(screen.getByRole("button",{name:"Explain my financial overview."}));
    await screen.findByText(reply.reply);
    expect(screen.getByText(/Financial data: simulated/)).toBeInTheDocument();
    mockFetch.mockImplementation(async(url:string)=>url==="/api/v1/me"?json(profile,200,{"X-CSRF-Token":"session-csrf"}):json({...reply,reply:'<img src=x onerror="alert(1)">'}));
    const input=screen.getByLabelText("Ask FinPilot");
    await user.type(input,"Explain more.{Enter}");
    await screen.findByText('<img src=x onerror="alert(1)">');
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(JSON.parse(chatCalls()[1][1].body)).toMatchObject({conversation_id:"owned-conversation",message:"Explain more."});
    expect(input).toHaveFocus();
  });
  it("prevents duplicate submission and shows progress only during the request",async () => {
    let release!:(value:Response)=>void;
    mockFetch.mockImplementation(async(url:string)=>url==="/api/v1/me"?json(profile,200,{"X-CSRF-Token":"session-csrf"}):new Promise<Response>(r=>release=r));
    await mount();const input=screen.getByLabelText("Ask FinPilot");
    fireEvent.change(input,{target:{value:"Explain."}});
    fireEvent.keyDown(input,{key:"Enter"});fireEvent.keyDown(input,{key:"Enter"});
    expect(chatCalls()).toHaveLength(1);expect(screen.getByText("FinPilot is preparing your response…")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Sending…"})).toBeDisabled();
    await act(async()=>release(json(reply)));
    await screen.findByText(reply.reply);expect(screen.queryByText("FinPilot is preparing your response…")).not.toBeInTheDocument();
  });
  it("clears private messages and aborts pending work when the user changes",async () => {
    await mount();await userEvent.click(screen.getByRole("button",{name:"Explain my financial overview."}));await screen.findByText(reply.reply);
    let signal:AbortSignal|undefined;let release!:(value:Response)=>void;
    mockFetch.mockImplementation(async(url:string,options:RequestInit)=>{
      if(url==="/api/v1/me")return json(currentProfile,200,{"X-CSRF-Token":"session-csrf"});
      signal=options.signal as AbortSignal;return new Promise<Response>(r=>release=r);
    });
    fireEvent.change(screen.getByLabelText("Ask FinPilot"),{target:{value:"Private follow-up."}});
    fireEvent.click(screen.getByRole("button",{name:"Send message"}));
    currentProfile={...profile,id:"user-b"};await userEvent.click(screen.getByRole("button",{name:"Test change user"}));
    await screen.findByLabelText("Ask FinPilot");expect(signal?.aborted).toBe(true);
    await act(async()=>release(json({...reply,reply:"Late private answer"})));
    expect(screen.queryByText(reply.reply)).not.toBeInTheDocument();expect(screen.queryByText("Private follow-up.")).not.toBeInTheDocument();expect(screen.queryByText("Late private answer")).not.toBeInTheDocument();
  });
  it("clears private messages on logout and on a server-expired session",async () => {
    await mount();await userEvent.click(screen.getByRole("button",{name:"Explain my financial overview."}));await screen.findByText(reply.reply);
    await userEvent.click(screen.getByRole("button",{name:"Test logout"}));
    expect(screen.queryByText(reply.reply)).not.toBeInTheDocument();expect(screen.getByRole("link",{name:"Sign in"})).toHaveAttribute("href","/login");
    await userEvent.click(screen.getByRole("button",{name:"Test change user"}));await screen.findByLabelText("Ask FinPilot");
    mockFetch.mockResolvedValue(json({},401));
    await userEvent.click(screen.getByRole("button",{name:"Explain my financial overview."}));await screen.findByRole("link",{name:"Sign in"});
  });
  it("shows safe provider failure without a fabricated assistant answer or automatic resend",async () => {
    await mount();mockFetch.mockResolvedValue(json({error:{message:"private-provider-error"}},503));
    await userEvent.click(screen.getByRole("button",{name:"What bills are coming up?"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("financial coach is unavailable");
    expect(screen.queryByLabelText("FinPilot reply")).not.toBeInTheDocument();expect(screen.queryByText("private-provider-error")).not.toBeInTheDocument();expect(chatCalls()).toHaveLength(1);
  });
  it("blocks sends during a rate-limit cooldown",async () => {
    await mount();mockFetch.mockResolvedValue(json({},429,{"Retry-After":"30"}));
    await userEvent.click(screen.getByRole("button",{name:"Explain my financial overview."}));
    await screen.findByRole("alert");expect(screen.getByLabelText("Ask FinPilot")).toBeDisabled();expect(screen.getByText(/Try again in 30 seconds/)).toBeInTheDocument();
    expect(chatCalls()).toHaveLength(1);
  });
  it("starts a new local conversation without claiming to delete server records",async () => {
    await mount();await userEvent.click(screen.getByRole("button",{name:"Explain my financial overview."}));await screen.findByText(reply.reply);
    await userEvent.click(screen.getByRole("button",{name:"New conversation"}));expect(screen.queryByText(reply.reply)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button",{name:"What bills are coming up?"}));await screen.findByText(reply.reply);
    expect(JSON.parse(chatCalls()[1][1].body)).not.toHaveProperty("conversation_id");
  });
});

describe('CHAT-05 context metadata',()=>{
  const context={mode:'session_only',retained_turns:2,max_turns:6,expires_after_seconds:900,snapshot_version:1,reset:'new_or_expired'};
  it('displays bounded session context and sends only the current message/conversation ID',async()=>{
    let calls=0;mockFetch.mockImplementation(async(url:string)=>url==='/api/v1/me'?json(profile,200,{'X-CSRF-Token':'session-csrf'}):json({...reply,context:{...context,retained_turns:++calls*2,reset:calls===1?'new_or_expired':'continued',unexpected_private_field:'drop-this'}}));
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));
    await screen.findByText('Context at last reply: 2/6 messages · Session only');
    const input=screen.getByLabelText('Ask FinPilot');await userEvent.type(input,'Which bill caused it?{Enter}');
    await screen.findByText('Context at last reply: 4/6 messages · Session only');
    expect(JSON.parse(chatCalls()[1][1].body)).toEqual({message:'Which bill caused it?',conversation_id:'owned-conversation'});
    expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
    await userEvent.click(screen.getByRole('button',{name:'New conversation'}));expect(screen.queryByText(/Context at last reply/)).not.toBeInTheDocument();
  });
  it('hides old financial answers when the server resets context for a changed snapshot',async()=>{
    let calls=0;mockFetch.mockImplementation(async(url:string)=>url==='/api/v1/me'?json(profile,200,{'X-CSRF-Token':'session-csrf'}):json({...reply,reply:++calls===1?'Old financial answer.':'Fresh financial explanation.',context:{...context,snapshot_version:calls===1?1:2,reset:calls===1?'new_or_expired':'snapshot_changed'}}));
    await mount();await userEvent.click(screen.getByRole('button',{name:'Explain my financial overview.'}));await screen.findByText('Old financial answer.');
    await userEvent.type(screen.getByLabelText('Ask FinPilot'),'Explain current data.{Enter}');await screen.findByText('Fresh financial explanation.');
    expect(screen.queryByText('Old financial answer.')).not.toBeInTheDocument();expect(screen.getByText(/Previous context was discarded/)).toBeInTheDocument();
  });
  it.each([{...context,retained_turns:8},{...context,mode:'global'},{...context,snapshot_version:0}])('rejects malformed context metadata',async value=>{
    mockFetch.mockResolvedValue(json({...reply,context:value}));await expect(chatApi.send({message:'Explain.'},{csrfToken:'csrf'})).rejects.toMatchObject({kind:'invalid-response'});
  });
  it('does not retain unknown response context fields',async()=>{
    mockFetch.mockResolvedValue(json({...reply,context:{...context,unexpected_private_field:'drop-this'}}));
    const value=await chatApi.send({message:'Explain.'},{csrfToken:'csrf'});expect(value.context).toEqual(context);
  });
});
