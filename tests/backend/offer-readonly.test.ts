import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPublishedCriteria,planningFundingGap,assessCardBenefit,freshOfficialTerms,type TermsEvidence,type BenefitInput} from '../../src/server/agents/planning/offer-readiness.ts';
const start='2026-11-08T13:00:00Z', now='2026-11-08T13:01:00Z';
const terms:TermsEvidence={sourceMode:'live',sourceUrl:'https://issuer.example.test/terms',retrievedAt:'2026-11-08T13:00:30Z',expiresAt:null,officialSourceVerified:true};
test('new requests reject old retrieval, fixtures, expiry and unverified sources',()=>{
 assert.equal(freshOfficialTerms(terms,start,now),true);
 for(const change of [{sourceMode:'fixture' as const},{sourceMode:'cached' as const},{retrievedAt:'2026-11-08T12:59:59Z'},{retrievedAt:'2026-11-08T13:02:00Z'},{expiresAt:now},{officialSourceVerified:false},{sourceUrl:'http://issuer.example.test/terms'}])
  assert.equal(freshOfficialTerms({...terms,...change},start,now),false);
 assert.equal(freshOfficialTerms(terms,'invalid',now),false);
});
test('a passing score is a criteria match, never odds or lender approval',()=>{
 const r=assessPublishedCriteria({creditScore:720},[{field:'creditScore',minimum:700,evidenceId:'published-1'}],terms,start,now);
 assert.equal(r.status,'matches_known_criteria');assert.equal(r.approvalProbability,null);assert.equal(r.lenderDecision,'not_checked');
});
test('missing income and unpublished criteria remain unknown',()=>{
 assert.equal(assessPublishedCriteria({creditScore:720},[{field:'grossMonthlyIncomeCents',minimum:300000,evidenceId:'income-rule'}],terms,start,now).status,'needs_information');
 assert.equal(assessPublishedCriteria({},[],terms,start,now).status,'needs_information');
});
test('failed published criteria and invalid ranges are distinguished',()=>{
 assert.equal(assessPublishedCriteria({creditScore:620},[{field:'creditScore',minimum:700,evidenceId:'score-rule'}],terms,start,now).status,'does_not_match_known_criteria');
 assert.equal(assessPublishedCriteria({},[{field:'creditScore',minimum:800,maximum:700,evidenceId:'bad'}],terms,start,now).status,'unavailable');
});
test('funding gap never becomes an approved amount',()=>{
 assert.deepEqual(planningFundingGap(3000000,2200000),{requestedCents:3000000,estimatedAffordableCents:2200000,estimatedFundingGapCents:800000,lenderApprovedCents:null,classification:'planning_estimate_only'});
 assert.equal(planningFundingGap(3000000,null).estimatedFundingGapCents,null);
 assert.throws(()=>planningFundingGap(-1,0),/INVALID_CENTS/);
});
const benefit:BenefitInput={accountId:'card-1',productId:'specific-card-product',productConfirmed:true,enrollmentRequired:true,enrollmentStatus:'enrolled',terms,issuerRemainingCents:1500,issuerUsageVerified:true,observationAt:'2026-11-08T13:00:40Z'};
const ctx={allowedAccountIds:['card-1'],requestStartedAt:start,now};
test('disconnected account and unidentified product cannot receive entitlement claims',()=>{
 assert.throws(()=>assessCardBenefit(benefit,{...ctx,allowedAccountIds:[]}),/ACCOUNT_NOT_AUTHORIZED/);
 assert.equal(assessCardBenefit({...benefit,productConfirmed:false},ctx).status,'needs_product_confirmation');
});
test('enrollment and personalized usage are required, not inferred from transactions',()=>{
 assert.equal(assessCardBenefit({...benefit,enrollmentStatus:'unknown'},ctx).status,'enrollment_unknown');
 assert.equal(assessCardBenefit({...benefit,enrollmentStatus:'not_enrolled'},ctx).status,'enrollment_required');
 assert.equal(assessCardBenefit({...benefit,issuerUsageVerified:false},ctx).status,'remaining_usage_unknown');
 assert.equal(assessCardBenefit({...benefit,observationAt:'2026-11-07T13:00:00Z'},ctx).status,'remaining_usage_unknown');
});
test('confirmed remaining balance is informational and has no redemption authority',()=>{
 const r=assessCardBenefit(benefit,ctx);
 assert.equal(r.status,'issuer_reported_remaining');assert.equal(r.confirmedRemainingCents,1500);
 assert.equal(r.canAutomaticallyEnroll,false);assert.equal(r.canRedeem,false);
 assert.equal(assessCardBenefit({...benefit,issuerRemainingCents:0},ctx).status,'fully_used');
});
