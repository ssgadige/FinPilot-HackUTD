import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {application} from './application';
import {CreditMonitor,CREDIT_PROVIDER} from '../../src/server/credit';
import {advancedCoachTools} from '../../src/server/agents/chat/advanced-tools';
import {retrieveTrustedPage,type Network} from '../../src/server/offers/source';
import {lookupMarket} from '../../src/server/offers/market';
import {Runs} from '../../src/server/runs';
import type {complete} from '../../src/server/nemotron';
const context={userId:'demo-01',runId:'test-run',snapshotVersion:1,allowedAccountIds:[]};

test('credit monitoring seeds all ten profiles, requires explicit owner connection and preserves disconnect',async()=>{
  const a=await application();try{
    const credit=new CreditMonitor(a.store);assert.equal(a.store.one('SELECT COUNT(*) AS n FROM credit_profiles')!.n,10);
    assert.equal((await a.request('credit')).data.profile,null);
    assert.equal((await a.request('credit/connect','POST',{provider_id:CREDIT_PROVIDER,confirmation:false})).status,400);
    assert.equal((await a.request('credit/connect','POST',{provider_id:CREDIT_PROVIDER,confirmation:true})).status,200);
    const profile=(await a.request('credit')).data;
    assert.equal(profile.profile.history.length,12);assert.equal(profile.approval.probability,null);assert.equal(profile.source_mode,'fixture');
    assert.equal((await a.request('credit', 'GET',undefined,1)).data.profile,null);
    assert.equal((await a.request('credit/connect','POST',{provider_id:CREDIT_PROVIDER,confirmation:true,user_id:'demo-02'})).status,400);
    const version=a.store.user('demo-01').snapshot_version;
    await a.request('credit/connect','POST',{provider_id:CREDIT_PROVIDER,confirmation:true});assert.equal(a.store.user('demo-01').snapshot_version,version);
    await a.request('credit','DELETE',{confirmation:true});assert.equal(new CreditMonitor(a.store).view('demo-01').profile,null);
    for(let i=0;i<10;i++){const uid=`demo-${String(i+1).padStart(2,'0')}`;const p=credit.connect(uid,CREDIT_PROVIDER).profile;assert.ok(p.score>=300&&p.score<=850);assert.equal(p.history.length,12);}
    assert.equal((await a.request('credit','GET',undefined,0,{cookie:''})).status,401);
    assert.equal((await a.request('credit','DELETE',{confirmation:true},0,{'x-csrf-token':'wrong'})).status,403);
  }finally{a.close();}
});

test('chat calculators use explicit hypothetical inputs and reject invented rates or identity fields',async()=>{
  let authorized=0;const tools=advancedCoachTools(async()=>{authorized++;},async()=>({connected:false}),'Calculate a $12,000 loan at 0% APR over 12 months.');
  const output=await tools.calculate_loan.execute({scope:'snapshot',principal_cents:1200000,apr_bps:0,months:12},context,new AbortController().signal);
  const data=output.data as {payment_cents:number;total_paid_cents:number;interest_cents:number};
  assert.equal(data.payment_cents,100000);assert.equal(data.interest_cents,0);assert.equal(data.total_paid_cents,1200000);assert.ok(output.evidence.length);assert.ok(authorized);
  const missing=advancedCoachTools(async()=>{},async()=>({}),'Calculate a $12,000 loan over 12 months.');
  const blocked=await missing.calculate_loan.execute({scope:'snapshot',principal_cents:1200000,apr_bps:650,months:12},context,new AbortController().signal);
  assert.equal(blocked.needsInformation,true);assert.equal((blocked.data as {calculation:unknown}).calculation,null);
  await assert.rejects(tools.calculate_loan.execute({scope:'snapshot',user_id:'demo-02'},context,new AbortController().signal));
  await assert.rejects(tools.calculate_loan.execute({scope:'snapshot',principal_cents:1,apr_bps:1,months:10000},context,new AbortController().signal));
});

function network(status=200,address='8.8.8.8',counter=()=>{}):Network {
  return {resolve:async()=>[{address,family:4}],request:(_url:unknown,_options:unknown,callback:(res:unknown)=>void)=>{
    counter();const req=Object.assign(new EventEmitter(),{destroy(){},end(){queueMicrotask(()=>{
      const res=Object.assign(new EventEmitter(),{statusCode:status,headers:{'content-type':'text/html'},destroy(){}});callback(res);res.emit('data',Buffer.from('<html><title>PNC Bank of America Chase Auto loans, Personal loans, Mortgages and Credit Cards</title></html>'));res.emit('end');
    });}});return req;
  }} as unknown as Network;
}
test('official lender lookup is fresh, fixed-source, redirect-safe and never fabricates verified terms',async()=>{
  let calls=0;const n=network(200,'8.8.8.8',()=>calls++),signal=new AbortController().signal;
  const first=await lookupMarket('auto_loan',signal,n),second=await lookupMarket('auto_loan',signal,n);
  assert.equal(calls,4);assert.ok(first.sources.every(s=>s.availability==='retrieved'&&s.retrieved_at));assert.equal(second.approval_status,'unknown');
  const unavailable=await lookupMarket('credit_card',signal,network(302));assert.ok(unavailable.sources.every(s=>s.availability==='unavailable'&&s.retrieved_at===null));
  let unsafeCalls=0;await lookupMarket('auto_loan',signal,network(200,'127.0.0.1',()=>unsafeCalls++));assert.equal(unsafeCalls,0);
  await assert.rejects(retrieveTrustedPage('https://www.pnc.com/redirect?url=http://127.0.0.1',signal,n));
  await assert.rejects(retrieveTrustedPage('https://attacker.example/',signal,n));
});

test('authenticated Nemotron chat protocol executes custom calculator and returns structured, evidence-backed results',async()=>{
  const a=await application();let calls=0;
  const infer:typeof complete=async(_config,messages,tools)=>{
    calls++;
    if(tools?.length){const name=tools[0].function.name;return {latencyMs:1,message:{role:'assistant',content:null,tool_calls:[{id:name,type:'function',function:{name,arguments:JSON.stringify(name==='calculate_loan'?{scope:'snapshot',principal_cents:1200000,apr_bps:0,months:12}:{scope:'snapshot'})}}]}};}
    const ids=[...new Set<string>(messages.filter(m=>m.role==='tool').flatMap(m=>JSON.parse(m.content!).evidence.map((e:{id:string})=>e.id)))];
    return {latencyMs:1,message:{role:'assistant',content:JSON.stringify({agent_id:'chat',status:'completed',headline:'Your hypothetical monthly payment is $1,000.00.',findings:[],evidence_ids:ids,assumptions:['This is not an approval.'],missing_data:[],proposed_actions:[],snapshot_version:a.store.user('demo-01').snapshot_version})}};
  };
  const runs=new Runs(a.store,a.auth,a.finance,a.planning,{infer,config:()=>({apiKey:'test-only-provider',model:'nvidia/nemotron',baseUrl:'https://example.test',timeoutMs:1000})});a.services.runs=runs;
  try{a.link();const r=await a.request('chat','POST',{message:'Calculate a $12,000 loan at 0% APR over 12 months.'});assert.equal(r.status,200);assert.ok(calls>=4);assert.equal(r.data.calculations[0].data.payment_cents,100000);assert.ok(r.data.answer.title.includes('$1,000.00'));assert.ok(r.data.evidence_ids.length);}
  finally{await runs.close();a.close();}
});
