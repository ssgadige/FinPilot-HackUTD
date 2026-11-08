import { retrieveTrustedPage, type Network } from './source.ts';
export const MARKET_PAGES={
  auto_loan:[['PNC','https://www.pnc.com/en/personal-banking/borrowing/auto-loans.html'],['Bank of America','https://www.bankofamerica.com/auto-loans/']],
  personal_loan:[['PNC','https://www.pnc.com/en/personal-banking/borrowing/personal-loans.html']],
  mortgage:[['PNC','https://www.pnc.com/en/personal-banking/borrowing/home-lending.html'],['Bank of America','https://www.bankofamerica.com/mortgage/']],
  credit_card:[['PNC','https://www.pnc.com/en/personal-banking/banking/credit-cards.html'],['Chase','https://creditcards.chase.com/']],
} as const;
export type MarketKind=keyof typeof MARKET_PAGES;
export async function lookupMarket(kind:MarketKind,signal:AbortSignal,network?:Network) {
  const attempted_at=new Date().toISOString();
  const sources=await Promise.all(MARKET_PAGES[kind].map(async([provider,url])=>{
    try {
      const html=await retrieveTrustedPage(url,signal,network,7000);
      const brand=provider==='PNC'?/\bpnc\b/i:provider==='Chase'?/\bchase\b/i:/bank\s+of\s+america/i;
      const product=kind==='auto_loan'?/auto|vehicle/i:kind==='mortgage'?/mortgage|home\s+(?:loan|lending)/i:kind==='personal_loan'?/personal\s+(?:loan|borrowing)/i:/credit\s*cards?/i;
      if(!/<(?:html|title|body)\b/i.test(html)||!brand.test(html)||!product.test(html)||/access denied|verify you are human|request blocked/i.test(html))throw Error('UNRECOGNIZED_PAGE');
      return {provider,url,category:kind,availability:'retrieved' as const,retrieved_at:new Date().toISOString(),source_mode:'live' as const,
        terms_status:'Review current terms on the official page; no rate or eligibility threshold was independently verified.'};
    }catch{signal.throwIfAborted();return {provider,url,category:kind,availability:'unavailable' as const,retrieved_at:null,source_mode:null,
      terms_status:'Live terms could not be retrieved. This is an official source link, not a verified offer.'};}
  }));
  return {kind,attempted_at,sources,comparison_status:'insufficient_verified_terms',approval_status:'unknown',limitations:['No approval percentage or approved amount is inferred.','Rates, fees, eligibility and promotional terms require review on the official source.','No application, credit pull, payment or transfer is performed.']};
}
