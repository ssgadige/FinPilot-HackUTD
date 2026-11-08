import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ baseURL: "http://127.0.0.1:3100" });
const reply={reply:"Your current findings are available for review. This response is a browser test fixture, not live inference.",evidence_ids:["calc-test-owned"],requested_run_id:null,conversation_id:"test-conversation",source_mode:"fixture",inference_source_mode:"cached"};
test.beforeEach(async({page})=>{
  await page.route("**/api/v1/me",route=>route.fulfill({headers:{"X-CSRF-Token":"test-csrf"},json:{id:"test-user",display_name:"Test fixture person",email:"test@example.test"}}));
  await page.route("**/api/v1/chat",route=>route.fulfill({json:reply}));
});
test("coach matches desktop/mobile layout, sends keyboard requests and renders safe text",async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto("/#coach");
  await expect(page.getByRole("heading",{name:"Ask about your next move"})).toBeVisible();
  await page.getByRole("button",{name:"Explain my financial overview."}).click();
  await expect(page.getByText(reply.reply,{exact:true})).toBeVisible();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"docs/tasks/CHAT-02/evidence/coach-fixture-1440.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByLabel("Ask FinPilot")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:"docs/tasks/CHAT-02/evidence/coach-fixture-390.png",fullPage:true});
  let input:unknown;
  await page.route("**/api/v1/chat",route=>{
    input=route.request().postDataJSON();return route.fulfill({json:{...reply,reply:'<img src=x onerror="alert(1)">'}});
  });
  await page.getByLabel("Ask FinPilot").fill("Explain more.");await page.getByLabel("Ask FinPilot").press("Enter");
  await expect(page.getByText('<img src=x onerror="alert(1)">',{exact:true})).toBeVisible();
  expect(input).toMatchObject({message:"Explain more.",conversation_id:"test-conversation"});
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect(page.getByLabel("Ask FinPilot")).toBeFocused();
});
test("provider unavailable is displayed without a fake reply or automatic retry",async({page})=>{
  let calls=0;await page.route("**/api/v1/chat",route=>{calls++;return route.fulfill({status:503,json:{error:{message:"private provider detail"}}});});
  await page.goto("/#coach");await page.getByRole("button",{name:"What bills are coming up?"}).click();
  await expect(page.getByRole("alert")).toContainText("financial coach is unavailable");
  await expect(page.getByLabel("FinPilot reply")).toHaveCount(0);
  await expect(page.getByText("private provider detail")).toHaveCount(0);expect(calls).toBe(1);
  await expect(page.getByLabel("Ask FinPilot")).toBeEnabled();
});

test("evidence drawer and actual checkup events work on desktop/mobile with cancellation and stale scope",async({page})=>{
  let cancelled=false,stale=false,reads=0,starts=0;
  const runId='browser-checkup';
  const run=()=>({run_id:runId,status:cancelled?'cancelled':'running',snapshot_version:1,stale,partial:false,model_calls:5,source_mode:'fixture',inference_source_mode:'cached',error_code:null,
    role_steps:[{role:'data-integrity',status:'completed',depends_on:[]},{role:'cash-collision',status:cancelled?'cancelled':'running',depends_on:['data-integrity']}],findings:[],trace:[]});
  await page.route('**/api/v1/evidence/*',route=>route.fulfill({json:{id:'calc-test-owned',run_id:'browser-source-run',kind:'calculation',source_id:'forecast_cash',source_mode:'fixture',observed_at:'2026-11-08T12:00:00Z',snapshot_version:1,
    payload_json:JSON.stringify({data:{balance_cents:50000,date:'2026-11-10'},assumptions:['Browser fixture only; selected checking account.']})}}));
  await page.route('**/api/v1/runs**',route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='POST'&&url.pathname==='/api/v1/runs'){starts++;return route.fulfill({status:202,json:{run_id:runId,status:'queued',snapshot_version:1}});}
    if(url.pathname.endsWith('/cancel')){cancelled=true;return route.fulfill({json:{run_id:runId,status:'cancelled'}});}
    if(url.pathname.endsWith('/events'))return route.fulfill({json:{items:[{id:cancelled?'cancel-event':'tool-event',run_id:runId,agent_id:'cash-collision',type:cancelled?'completed':'tool_started',message:cancelled?'Cancellation requested; no new calls.':'forecast_cash',at:'2026-11-08T12:00:00Z'}],next_cursor:cancelled?'2':'1',has_more:false,stale}});
    reads++;return route.fulfill({json:run()});
  });
  await page.setViewportSize({width:1440,height:1000});await page.goto('/#coach');
  await page.getByRole('button',{name:'Explain my financial overview.'}).click();
  const source=page.getByRole('button',{name:'Inspect answer source 1'});await source.click();
  const drawer=page.getByRole('dialog',{name:'Finding evidence'});await expect(drawer.getByText('$500.00')).toBeVisible();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:'docs/tasks/CHAT-03/evidence/source-fixture-1440.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'docs/tasks/CHAT-03/evidence/source-fixture-390.png',fullPage:true});
  await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(source).toBeFocused();
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Run financial checkup'}).click();
  await expect(page.getByRole('status').filter({hasText:'Status: running'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cancel checkup'})).toBeVisible();expect(starts).toBe(1);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:'docs/tasks/CHAT-04/evidence/run-fixture-1440.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.screenshot({path:'docs/tasks/CHAT-04/evidence/run-fixture-390.png',fullPage:true});
  await page.getByRole('button',{name:'Cancel checkup'}).click();await expect(page.getByRole('status').filter({hasText:'Status: cancelled'})).toBeVisible();
  const terminalReads=reads;await page.waitForTimeout(2200);expect(reads).toBe(terminalReads);
  stale=true;await page.evaluate(()=>window.dispatchEvent(new Event('finpilot:finance-invalidated')));
  await expect(page.getByText(/Old findings and tool results are hidden/)).toBeVisible();await expect(page.getByText(reply.reply,{exact:true})).toHaveCount(0);expect(starts).toBe(1);
});

test('ambiguous create retries retain the same key, and inaccessible sources stay hidden',async({page})=>{
  const keys:string[]=[];
  await page.route('**/api/v1/evidence/*',route=>route.fulfill({status:404,json:{error:{message:'Object not found'}}}));
  await page.route('**/api/v1/runs**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/v1/runs'&&route.request().method()==='POST'){
      keys.push(route.request().postDataJSON().idempotency_key);
      return keys.length===1?route.abort('failed'):route.fulfill({status:202,json:{run_id:'browser-retry',status:'queued',snapshot_version:1}});
    }
    if(url.pathname.endsWith('/events'))return route.fulfill({json:{items:[],next_cursor:'0',has_more:false,stale:false}});
    return route.fulfill({json:{run_id:'browser-retry',status:'completed',snapshot_version:1,stale:false,partial:false,model_calls:12,source_mode:'fixture',inference_source_mode:'cached',error_code:null,role_steps:[],findings:[],trace:[]}});
  });
  await page.goto('/#coach');await page.getByRole('button',{name:'Run financial checkup'}).click();
  await expect(page.getByRole('button',{name:'Retry same checkup request'})).toBeEnabled();expect(keys).toHaveLength(1);
  await page.getByRole('button',{name:'Retry same checkup request'}).click();await expect(page.getByRole('status').filter({hasText:'Status: completed'})).toBeVisible();
  expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
  await page.getByRole('button',{name:'Explain my financial overview.'}).click();await page.getByRole('button',{name:'Inspect answer source 1'}).click();
  await expect(page.getByRole('dialog').getByText('Evidence unavailable',{exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByText('$500.00')).toHaveCount(0);expect(keys).toHaveLength(2);
});

test('bounded follow-ups use session context metadata, reset on new conversation and discard old snapshot answers',async({page})=>{
  let turns:string[]=[];let snapshot=1;let resetSnapshot=false;
  const requests:Record<string,unknown>[]=[];
  await page.route('**/api/v1/chat',route=>{
    const input=route.request().postDataJSON() as Record<string,unknown>;requests.push(input);
    expect(input).not.toHaveProperty('history');expect(input).not.toHaveProperty('user_id');
    if(!input.conversation_id||resetSnapshot)turns=[];
    const previous=turns.join(' ');turns.push(String(input.message));
    const text=resetSnapshot?'Browser fixture: this explanation uses the changed snapshot.':previous.includes('car')?'Browser fixture: we are discussing your car goal. What deadline do you have?':'Browser fixture: what is your savings target?';
    return route.fulfill({json:{...reply,reply:text,context:{mode:'session_only',retained_turns:Math.min(6,turns.length*2),max_turns:6,expires_after_seconds:900,snapshot_version:snapshot,reset:resetSnapshot?'snapshot_changed':input.conversation_id?'continued':'new_or_expired'}}});
  });
  await page.setViewportSize({width:1440,height:1000});await page.goto('/#coach');
  await page.getByLabel('Ask FinPilot').fill('I want a car.');await page.getByLabel('Ask FinPilot').press('Enter');
  await expect(page.getByText('Context at last reply: 2/6 messages · Session only')).toBeVisible();
  await page.getByLabel('Ask FinPilot').fill('Ten thousand dollars.');await page.getByLabel('Ask FinPilot').press('Enter');
  await expect(page.getByText('Browser fixture: we are discussing your car goal. What deadline do you have?',{exact:true})).toBeVisible();
  await expect(page.getByText('Context at last reply: 4/6 messages · Session only')).toBeVisible();
  expect(requests[1].conversation_id).toBe('test-conversation');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/tasks/CHAT-05/evidence/context-fixture-1440.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'docs/tasks/CHAT-05/evidence/context-fixture-390.png',fullPage:true});
  snapshot=2;resetSnapshot=true;
  await page.getByLabel('Ask FinPilot').fill('Use the changed records.');await page.getByLabel('Ask FinPilot').press('Enter');
  await expect(page.getByText('Browser fixture: this explanation uses the changed snapshot.',{exact:true})).toBeVisible();
  await expect(page.getByText('Browser fixture: we are discussing your car goal. What deadline do you have?',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/Previous context was discarded/)).toBeVisible();
  resetSnapshot=false;
  await page.getByRole('button',{name:'New conversation'}).click();await page.getByLabel('Ask FinPilot').fill('Start a different discussion.');await page.getByLabel('Ask FinPilot').press('Enter');
  await expect(page.getByText('Browser fixture: what is your savings target?',{exact:true})).toBeVisible();expect(requests.at(-1)).not.toHaveProperty('conversation_id');
});

test('two isolated users, logout and a subsequent identity cannot expose another transcript',async({browser})=>{
  const contextA=await browser.newContext(),contextB=await browser.newContext();
  let identityA='user-a',signedInA=true;
  async function prepare(context:typeof contextA,identity:()=>string,signedIn:()=>boolean){
    await context.route('**/api/v1/me',route=>signedIn()?route.fulfill({headers:{'X-CSRF-Token':'fixture-csrf'},json:{id:identity(),display_name:`Fixture ${identity()}`,email:`${identity()}@example.test`}}):route.fulfill({status:401,json:{error:{code:'unauthenticated'}}}));
    await context.route('**/api/v1/chat',route=>route.fulfill({json:{...reply,reply:`Private browser fixture reply for ${identity()}.`,conversation_id:`conversation-${identity()}`}}));
  }
  try{
    await prepare(contextA,()=>identityA,()=>signedInA);await prepare(contextB,()=> 'user-b',()=>true);
    await contextA.route('**/api/v1/auth/logout',route=>{signedInA=false;return route.fulfill({status:204,body:''});});
    const pageA=await contextA.newPage(),pageB=await contextB.newPage();
    await pageA.goto('http://127.0.0.1:3100/#coach');await pageB.goto('http://127.0.0.1:3100/#coach');
    await pageA.getByRole('button',{name:'Explain my financial overview.'}).click();await pageB.getByRole('button',{name:'Explain my financial overview.'}).click();
    await expect(pageA.getByText('Private browser fixture reply for user-a.',{exact:true})).toBeVisible();await expect(pageB.getByText('Private browser fixture reply for user-b.',{exact:true})).toBeVisible();
    await expect(pageA.getByText('Private browser fixture reply for user-b.',{exact:true})).toHaveCount(0);await expect(pageB.getByText('Private browser fixture reply for user-a.',{exact:true})).toHaveCount(0);
    await pageA.getByRole('button',{name:'Sign out'}).click();await expect(pageA.getByRole('heading',{name:'Sign in to continue'})).toBeVisible();await expect(pageA.getByText('Private browser fixture reply for user-a.',{exact:true})).toHaveCount(0);
    await expect(pageB.getByText('Private browser fixture reply for user-b.',{exact:true})).toBeVisible();
    identityA='user-c';signedInA=true;await pageA.goto('http://127.0.0.1:3100/#coach');
    await expect(pageA.getByRole('button',{name:'Explain my financial overview.'})).toBeVisible();await expect(pageA.getByText('Private browser fixture reply for user-a.',{exact:true})).toHaveCount(0);
    await pageA.getByRole('button',{name:'Explain my financial overview.'}).click();await expect(pageA.getByText('Private browser fixture reply for user-c.',{exact:true})).toBeVisible();
  }finally{await contextA.close();await contextB.close();}
});

test('expired session hides the entire coach and does not resend the failed message',async({page})=>{
  let calls=0;
  await page.route('**/api/v1/chat',route=>++calls===1?route.fulfill({json:{...reply,reply:'Private explanation before expiry.'}}):route.fulfill({status:401,json:{error:{code:'unauthenticated'}}}));
  await page.goto('/#coach');await page.getByRole('button',{name:'Explain my financial overview.'}).click();await expect(page.getByText('Private explanation before expiry.',{exact:true})).toBeVisible();
  await page.getByLabel('Ask FinPilot').fill('Explain more.');await page.getByLabel('Ask FinPilot').press('Enter');
  await expect(page.getByRole('heading',{name:'Sign in to continue'})).toBeVisible();
  await expect(page.getByText('Private explanation before expiry.',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Ask FinPilot')).toHaveCount(0);expect(calls).toBe(2);
});
