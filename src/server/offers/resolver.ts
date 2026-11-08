import type { OfferResolver } from '../planning';
import type { Store } from '../db';
import { configuredFetchOffers } from './source';
import { found } from '../errors';

/** Reuse the existing fixed-provider fetcher; merchant text never selects a URL. */
export function offerResolver(store:Store):OfferResolver {
 return {async list(uid,subscriptionId,signal){
  const subscription=found(store.scoped('subscriptions',uid).find(s=>s.id===subscriptionId));
  // Only the supported music comparison is meaningful. Other categories stay empty.
  const preferences=JSON.parse(subscription.preferences_json);
  if(preferences.category!=='music')return {items:[],source_mode:'fixture',availability:'unavailable'};
  const response=await configuredFetchOffers(signal);
  found(store.scoped('subscriptions',uid).find(s=>s.id===subscriptionId));
  return {items:response.offers.map(source=>({...source.offer,billing_months:source.billing_months,promotion:source.promo,terms:source.terms,retrieved_at:response.retrieved_at,availability:response.availability})),source_mode:response.source_mode,availability:response.availability};
 }};
}
