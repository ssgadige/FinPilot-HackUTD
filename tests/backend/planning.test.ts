import { test } from 'node:test';
import assert from 'node:assert/strict';
import { token,iso } from '../../src/server/auth';
import type { PlanPayload } from '../../src/server/planning';
import { application } from './application';
function completed(app:Awaited<ReturnType<typeof application>>,uid='demo-01') {
  const id=token();app.store.exec("INSERT INTO runs VALUES(?,?,?,'completed',?,?,?,NULL)",id,uid,'test',app.store.user(uid).snapshot_version,id,iso());return id;
}
const payload=(overrides:Partial<PlanPayload>={}):PlanPayload=>({allocations:[],reserve_cents:10000,evidence_ids:[],assumptions:['Synthetic test proposal'],...overrides});
test('FP-14: simultaneous accepts select one plan; replay and foreign ownership are enforced',async()=>{
  const a=await application();try {
    const p=a.planning.propose('demo-01',completed(a),payload());
    const accept=(key:string,index=0)=>a.request('plans/'+p.id+'/accept','POST',{expected_version:1,confirmation:true,idempotency_key:key},index);
    const results=await Promise.all([accept('a'),accept('b')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const winner=results[0].status===200?'a':'b';assert.equal((await accept(winner)).status,200);assert.equal((await accept('foreign',1)).status,404);
    assert.equal((await a.request('plans/'+p.id+'/accept','POST',{expected_version:2,confirmation:false,idempotency_key:'no'})).status,400);
    const competing=a.planning.propose('demo-01',completed(a),payload());
    assert.equal(a.planning.plan('demo-01',p.id).status,'accepted');assert.equal(competing.status,'proposed');
  }finally{a.close();}
});
test('FP-14: failed revision and failed atomic acceptance preserve the accepted plan',async()=>{
  const a=await application();try {
    const p=a.planning.propose('demo-01',completed(a),payload());a.planning.accept('demo-01',p.id,{expected_version:1,confirmation:true,idempotency_key:'accept'});
    assert.throws(()=>a.planning.propose('demo-01','missing',payload(),p.id),{code:'not_found'});
    const revision=a.planning.propose('demo-01',completed(a),payload(),p.id);
    a.store.db.exec("CREATE TRIGGER reject_revision BEFORE UPDATE OF status ON plans WHEN NEW.id='"+revision.id+"' AND NEW.status='accepted' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
    assert.throws(()=>a.planning.accept('demo-01',revision.id,{expected_version:revision.version,confirmation:true,idempotency_key:'revision'}));
    assert.equal(a.planning.plan('demo-01',p.id).status,'accepted');assert.equal(a.planning.plan('demo-01',revision.id).status,'proposed');
    a.store.db.exec('DROP TRIGGER reject_revision');a.planning.accept('demo-01',revision.id,{expected_version:revision.version,confirmation:true,idempotency_key:'revision'});
    assert.equal(a.planning.plan('demo-01',p.id).status,'superseded');assert.equal(a.planning.plan('demo-01',revision.id).status,'accepted');
  }finally{a.close();}
});
test('FP-14: goal CRUD, confirmation, subscription intentions and foreign mutations',async()=>{
  const a=await application();try {
    a.link();const c=await a.request('goals','POST',{title:'Transport',target_cents:200000,deadline:'2027-12-01',priority:2});assert.equal(c.status,201);
    assert.equal((await a.request('goals/'+c.data.id,'PATCH',{title:'Updated',priority:1})).data.title,'Updated');
    assert.equal((await a.request('goals/'+c.data.id,'PATCH',{priority:1},1)).status,404);
    assert.equal((await a.request('goals/'+c.data.id,'DELETE',{confirmation:true},1)).status,404);
    assert.equal((await a.request('goals/'+c.data.id,'DELETE',{confirmation:true})).status,204);
    assert.equal((await a.request('goals/'+c.data.id)).status,404);
    const sub=a.store.scoped('subscriptions','demo-01')[0];const before=a.finance.overview('demo-01');
    assert.equal((await a.request('subscriptions/'+sub.id,'PATCH',{usage_confirmed:'unused',confirmation:true},1)).status,404);
    assert.equal((await a.request('subscriptions/'+sub.id,'PATCH',{usage_confirmed:'unused',confirmation:true})).status,200);
    const result=await a.request('subscription-actions','POST',{subscription_id:sub.id,cancel_intention:true,confirmation:true});
    assert.equal(result.status,201);assert.equal(result.data.realized_savings_cents,0);assert.equal(result.data.status,'planned');
    const after=a.finance.overview('demo-01');assert.equal(after.liquid_cash_cents,before.liquid_cash_cents);assert.equal(after.income_cents,before.income_cents);
    assert.equal((await a.request('subscription-actions','POST',{subscription_id:sub.id,cancel_intention:true,confirmation:false})).status,400);
    assert.equal((await a.request('subscription-actions','POST',{subscription_id:sub.id,cancel_intention:true,confirmation:true},1)).status,404);
  }finally{a.close();}
});
test('FP-14: plan scenarios reserve allocations once, are read-only, owned and snapshot-bound',async()=>{
  const a=await application();try {
    a.link();const goal=a.store.one('SELECT id FROM goals WHERE user_id=?','demo-01')!;const day=Number(a.finance.asOf().slice(-2))===10?11:10;
    const p=a.planning.propose('demo-01',completed(a),payload({allocations:[{kind:'goal_contribution',target_id:goal.id,monthly_cents:1234,day_of_month:day}]}));
    const input={kind:'surprise_expense',expense_cents:5000};const baseline=await a.request('scenarios','POST',input),scenario=await a.request('scenarios','POST',{...input,plan_id:p.id});
    assert.equal(scenario.status,201);assert.equal(scenario.data.plan_id,p.id);assert.equal(scenario.data.source_mode,'fixture');
    const due=baseline.data.dated_balances.slice(1).filter((r:{date:string})=>Number(r.date.slice(-2))===day).length;
    assert.equal(scenario.data.dated_balances.at(-1).balance_cents,baseline.data.dated_balances.at(-1).balance_cents-1234*due);
    assert.equal((await a.request('scenarios','POST',{...input,plan_id:p.id},1)).status,404);
    assert.equal((await a.request('evidence/'+scenario.data.evidence_ids[0],undefined,undefined,1)).status,404);
    a.planning.accept('demo-01',p.id,{expected_version:1,confirmation:true,idempotency_key:'p'});a.planning.updateGoal('demo-01',goal.id,{priority:2});
    assert.equal(a.planning.plan('demo-01',p.id).status,'accepted');assert.equal(a.planning.view('demo-01',p.id).payload,null);
    assert.equal((await a.request('scenarios','POST',{...input,plan_id:p.id})).status,409);
  }finally{a.close();}
});
test('FP-14: proposal validation rejects foreign goal, disconnected debt and forged evidence',async()=>{
  const a=await application();try {
    const run=completed(a);
    for(const input of [payload({evidence_ids:['foreign']}),payload({allocations:[{kind:'goal_contribution',target_id:'demo-02-g0',monthly_cents:1,day_of_month:1}]}),payload({allocations:[{kind:'extra_debt_payment',target_id:'demo-01-a3',monthly_cents:1,day_of_month:1}]})])assert.throws(()=>a.planning.propose('demo-01',run,input));
    assert.throws(()=>a.planning.propose('demo-02',run,payload()),{code:'not_found'});
    assert.equal(a.store.one('SELECT COUNT(*) AS n FROM plans')!.n,0);
  }finally{a.close();}
});
