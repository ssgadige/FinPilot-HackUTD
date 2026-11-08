export const officialOfferUrls = [
  'https://www.pnc.com/en/personal-banking/borrowing/auto-loans.html',
  'https://www.bankofamerica.com/auto-loans/',
  'https://www.pnc.com/en/personal-banking/borrowing/personal-loans.html',
  'https://www.pnc.com/en/personal-banking/borrowing/home-lending.html',
  'https://www.bankofamerica.com/mortgage/',
  'https://www.pnc.com/en/personal-banking/banking/credit-cards.html',
  'https://creditcards.chase.com/',
] as const;
export function isOfficialOfferUrl(url:string) {return (officialOfferUrls as readonly string[]).includes(url);}
