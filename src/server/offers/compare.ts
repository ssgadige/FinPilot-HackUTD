import type { SourcedOffer } from './source.ts';
export interface Preferences {
  confirmed: boolean; usage: 'used' | 'unused' | 'unknown'; country: 'US' | null;
  required_features: string[]; accounts: number | null; new_customer: boolean | null;
  upfront_budget_cents: number | null; keep_service: boolean | null;
}
export function cents(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error('INVALID_CENTS'); return n; }
export function compareCost(currentMonthlyCents: number, preferences: Preferences, source: SourcedOffer, asOf: string, currentYearCents?: number) {
  const o = source.offer; cents(currentMonthlyCents); cents(o.upfront_cents); cents(o.monthly_equivalent_cents);
  const renewal = o.renewal_cents === null ? null : cents(o.renewal_cents);
  const reasons: string[] = [];
  if (!preferences.confirmed) reasons.push('subscription/preferences are not confirmed');
  if (preferences.usage === 'unknown' || preferences.keep_service !== true) reasons.push('usage/keep preference is unknown; never assume unused');
  if (preferences.country !== source.country || preferences.accounts !== source.accounts) reasons.push('country/account eligibility is unconfirmed or incompatible');
  if (!preferences.required_features.length || preferences.required_features.some(f => !o.features.includes(f))) reasons.push('required features are unknown or not equivalent');
  if (!source.verified || o.source_mode !== 'live' || !o.verified_at || !o.source_url) reasons.push('offer is unverified or fixture; availability is not established');
  if (o.currency !== 'USD' || ![1,12].includes(source.billing_months) || !renewal) reasons.push('billing/renewal terms are unavailable');
  if (o.verified_at && (!Number.isFinite(Date.parse(o.verified_at)) || Math.abs(Date.parse(asOf) - Date.parse(o.verified_at)) > 86400000)) reasons.push('offer verification is stale');
  if (o.monthly_equivalent_cents !== Math.ceil(o.upfront_cents / source.billing_months)) reasons.push('normalized cost conflicts with upfront billing');
  let promoApplied = false; const promoNotes: string[] = [];
  if (source.promo) {
    const p = source.promo; cents(p.price_cents);
    if (!Number.isInteger(p.months) || p.months < 1 || p.months > 12) throw new Error('INVALID_PROMO');
    promoApplied = source.billing_months === 1 && (!p.requires_new_customer || preferences.new_customer === true) &&
      o.promo_end !== null && Number.isFinite(Date.parse(o.promo_end)) && o.promo_end >= asOf.slice(0,10);
    if (!promoApplied) promoNotes.push('introductory promotion excluded: eligibility or expiry is unverified; use standard renewal pricing');
  }
  const firstYear = cents(source.billing_months === 12 ? o.upfront_cents : promoApplied
    ? source.promo!.months * source.promo!.price_cents + (12 - source.promo!.months) * (renewal ?? o.upfront_cents)
    : o.upfront_cents + 11 * (renewal ?? o.upfront_cents));
  const upfront = promoApplied ? source.promo!.price_cents : o.upfront_cents;
  if (source.billing_months === 12 && (preferences.upfront_budget_cents === null || preferences.upfront_budget_cents < upfront)) reasons.push('annual upfront payment exceeds confirmed budget or budget is unknown');
  const currentYear = cents(currentYearCents ?? currentMonthlyCents * 12);
  const comparable = reasons.length === 0;
  return { offer_id: o.id, comparable, uncertainty: reasons, promo_notes: promoNotes, promo_applied: promoApplied,
    current_year_cents: currentYear, first_year_cents: firstYear, upfront_due_cents: upfront,
    current_monthly_equivalent_cents: currentMonthlyCents,
    monthly_equivalent_cents: o.monthly_equivalent_cents, renewal_cents: renewal,
    verified_potential_savings_cents: comparable ? Math.max(0, currentYear - firstYear) : null,
    potential_monthly_savings_cents: comparable ? Math.floor(Math.max(0, currentYear - firstYear) / 12) : null,
    illustrative_difference_cents: currentYear - firstYear, realized_savings_cents: 0,
    requires_confirmation: true, taxes: 'not included; final terms must be reviewed', offer_source_mode: o.source_mode };
}
