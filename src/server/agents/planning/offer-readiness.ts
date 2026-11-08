/** Pure read-only assessment helpers. No network, credentials or execution authority.
 * Runtime adapters must load authenticated, currently consented evidence first.
 * These helpers do not constitute a lender decision or a live-search integration.
 */
export type SourceMode = 'live' | 'fixture' | 'cached';
export interface TermsEvidence {
  sourceMode: SourceMode;
  sourceUrl: string;
  retrievedAt: string;
  expiresAt: string | null;
  officialSourceVerified: boolean;
}
export type CriterionField = 'creditScore' | 'grossMonthlyIncomeCents' | 'monthsInBusiness' | 'annualBusinessRevenueCents';
export interface PublishedCriterion {
  field: CriterionField;
  minimum?: number;
  maximum?: number;
  evidenceId: string;
}
export interface Assessment {
  status: 'matches_known_criteria' | 'does_not_match_known_criteria' | 'needs_information' | 'unavailable';
  reasons: string[];
  missing: CriterionField[];
  approvalProbability: null;
  lenderDecision: 'not_checked';
}
const fields: readonly CriterionField[] = ['creditScore', 'grossMonthlyIncomeCents', 'monthsInBusiness', 'annualBusinessRevenueCents'];
function validNumber(n: unknown): n is number { return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0; }
export function freshOfficialTerms(e: TermsEvidence, requestStartedAt: string, now: string): boolean {
  const retrieved=Date.parse(e.retrievedAt), started=Date.parse(requestStartedAt), current=Date.parse(now);
  const expires=e.expiresAt === null ? null : Date.parse(e.expiresAt);
  try {
    return e.sourceMode === 'live' && e.officialSourceVerified && new URL(e.sourceUrl).protocol === 'https:' &&
      [retrieved,started,current].every(Number.isFinite) && started <= current && retrieved >= started && retrieved <= current &&
      (expires === null || (Number.isFinite(expires) && expires > current));
  } catch { return false; }
}
export function assessPublishedCriteria(
  values: Partial<Record<CriterionField, number | null>>,
  criteria: readonly PublishedCriterion[],
  evidence: TermsEvidence,
  requestStartedAt: string,
  now: string,
): Assessment {
  const result: Assessment={status:'needs_information',reasons:[],missing:[],approvalProbability:null,lenderDecision:'not_checked'};
  if (!freshOfficialTerms(evidence,requestStartedAt,now)) return {...result,status:'unavailable',reasons:['Fresh verified official terms are unavailable.']};
  if (criteria.length === 0) return {...result,reasons:['The provider has not published sufficient eligibility criteria.']};
  let failed=false;
  for (const c of criteria) {
    if (!fields.includes(c.field) || !c.evidenceId ||
      (c.minimum === undefined && c.maximum === undefined) ||
      (c.minimum !== undefined && !validNumber(c.minimum)) || (c.maximum !== undefined && !validNumber(c.maximum)) ||
      (c.minimum !== undefined && c.maximum !== undefined && c.minimum > c.maximum))
      return {...result,status:'unavailable',reasons:['Invalid or unsupported published criteria.']};
    const value=values[c.field];
    if (!validNumber(value) || (c.field === 'creditScore' && (value < 300 || value > 850))) {
      if (!result.missing.includes(c.field)) result.missing.push(c.field);
    } else if ((c.minimum !== undefined && value < c.minimum) || (c.maximum !== undefined && value > c.maximum)) {
      failed=true; result.reasons.push(`${c.field}: outside a published requirement.`);
    }
  }
  result.status=failed ? 'does_not_match_known_criteria' : result.missing.length ? 'needs_information' : 'matches_known_criteria';
  result.reasons.push('Published-criteria matching is not prequalification, approval or a personalized credit limit.');
  return result;
}
export function planningFundingGap(requestedCents: number, estimatedAffordableCents: number | null) {
  if (!validNumber(requestedCents) || requestedCents === 0 || (estimatedAffordableCents !== null && !validNumber(estimatedAffordableCents)))
    throw new Error('INVALID_CENTS');
  return {requestedCents,estimatedAffordableCents,
    estimatedFundingGapCents: estimatedAffordableCents === null ? null : Math.max(0,requestedCents-estimatedAffordableCents),
    lenderApprovedCents:null, classification:'planning_estimate_only' as const};
}
export interface BenefitInput {
  accountId: string;
  productId: string | null;
  productConfirmed: boolean;
  enrollmentRequired: boolean;
  enrollmentStatus: 'enrolled' | 'not_enrolled' | 'unknown';
  terms: TermsEvidence;
  issuerRemainingCents: number | null;
  issuerUsageVerified: boolean;
  observationAt: string | null;
}
export interface ReadContext {
  /** Constructed by the server after rechecking ownership and current consent. */
  allowedAccountIds: readonly string[];
  requestStartedAt: string;
  now: string;
}
export function assessCardBenefit(b: BenefitInput, ctx: ReadContext) {
  if (!ctx.allowedAccountIds.includes(b.accountId)) throw new Error('ACCOUNT_NOT_AUTHORIZED');
  const base={accountId:b.accountId,confirmedRemainingCents:null as number|null,canAutomaticallyEnroll:false as const,canRedeem:false as const};
  if (!b.productId || !b.productConfirmed) return {...base,status:'needs_product_confirmation' as const};
  if (!freshOfficialTerms(b.terms,ctx.requestStartedAt,ctx.now)) return {...base,status:'terms_unavailable' as const};
  if (b.enrollmentRequired && b.enrollmentStatus !== 'enrolled')
    return {...base,status:b.enrollmentStatus === 'not_enrolled' ? 'enrollment_required' as const : 'enrollment_unknown' as const};
  // A transaction ledger alone cannot prove personalized entitlement or unused credits.
  const observed=b.observationAt === null ? NaN : Date.parse(b.observationAt);
  if (!b.issuerUsageVerified || !validNumber(b.issuerRemainingCents) ||
      !Number.isFinite(observed) || observed < Date.parse(ctx.requestStartedAt) || observed > Date.parse(ctx.now))
    return {...base,status:'remaining_usage_unknown' as const};
  return {...base,status:b.issuerRemainingCents === 0 ? 'fully_used' as const : 'issuer_reported_remaining' as const,
    confirmedRemainingCents:b.issuerRemainingCents};
}
