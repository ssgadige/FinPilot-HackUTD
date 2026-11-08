import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures';
import { BackendAgentBridge } from '../../src/server/agents/integration/backend';
import { Simulator } from '../../src/server/simulator';

test('FP-24: agent backend bridge honors actual consent, joined ownership and disconnect',async()=>{
  const f=fixture();try{
    const bridge=new BackendAgentBridge(f.store);const uid=f.credentials[0].user_id;const other=f.credentials[1].user_id;
    assert.equal(bridge.contextFor(uid,'before-link').allowedAccountIds.length,0);
    const simulator=new Simulator(f.store);const institution=f.credentials[0].institutions[0];
    const preview=simulator.preview(uid,institution.institution_id,institution.username,institution.password);
    const ids=preview.accounts.map(a=>a.id);
    const connected=simulator.connect(uid,{preview_token:preview.preview_token,account_ids:ids,consent_version:'v1',idempotency_key:'agent-bridge-link'});
    const context=bridge.contextFor(uid,'owned-agent-run');assert.ok(context.allowedAccountIds.length>0);
    const snapshot=await bridge.legacy(context);assert.ok(snapshot.transactions.length>0);
    assert.ok(snapshot.transactions.every(t=>t.userId===uid&&context.allowedAccountIds.includes(t.accountId)));
    assert.ok(!JSON.stringify(snapshot).includes('scrypt$'));
    await assert.rejects(bridge.legacy({...context,userId:other}));
    const tools=bridge.toolsFor('data-integrity')!;
    const result=await tools.reconcile_ledger.execute({scope:'snapshot'},context,new AbortController().signal);
    assert.deepEqual((result.data as {mismatches:unknown[]}).mismatches,[]);
    simulator.revoke(uid,connected.id);
    await assert.rejects(bridge.legacy(context));
    assert.equal(bridge.toolsFor('goal-allocator'),null);
  }finally{f.close();}
});
