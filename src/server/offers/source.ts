import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createHash } from 'node:crypto';
import type { Offer } from '../../../contracts/types.ts';
export const SOURCE_URL = 'https://www.spotify.com/us/premium/';
const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked.addSubnet(address, prefix, 'ipv4');
export function publicIPv4(address: string) { return isIP(address) === 4 && !blocked.check(address, 'ipv4'); }
export function allowedSource(url: string) { return url === SOURCE_URL; }
export interface SourcedOffer {
  offer: Offer; billing_months: 1 | 12; verified: boolean; country: 'US'; accounts: number;
  terms: string; terms_sha256: string;
  promo: { months: number; price_cents: number; requires_new_customer: boolean } | null;
}
export interface OfferFetch {
  availability: 'available' | 'unavailable' | 'fixture_fallback';
  source_mode: 'live' | 'fixture'; retrieved_at: string | null; attempted_at: string;
  source_url: string; reason: string | null; offers: SourcedOffer[];
}
export interface Network {
  resolve: typeof lookup; request: typeof request;
}
// Only the fixed provider URL is reachable. IPv4 is intentionally used so every
// address can be validated and pinned; IPv6, redirects and proxy env are unused.
export async function retrievePage(signal: AbortSignal, network: Network = { resolve: lookup, request }, timeoutMs = 10000): Promise<string> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error('OFFER_TIMEOUT_CONFIG');
  const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  return new Promise((resolve, reject) => {
    let req: ReturnType<typeof request> | undefined;
    const abort = () => { req?.destroy(); reject(new Error('OFFER_TIMEOUT_OR_CANCELLED')); };
    if (combined.aborted) { abort(); return; }
    combined.addEventListener('abort', abort, { once: true });
    const finish = (error?: Error, html?: string) => {
      combined.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(html!);
    };
    network.resolve('www.spotify.com', { all: true, family: 4 }).then(addresses => {
      if (combined.aborted) return;
      if (!addresses.length || addresses.some(a => !publicIPv4(a.address))) { finish(new Error('OFFER_UNSAFE_DESTINATION')); return; }
      const pinned = addresses[0].address;
      req = network.request(SOURCE_URL, { method: 'GET', signal: combined, agent: false,
        headers: { Accept: 'text/html', 'Accept-Encoding': 'identity', 'User-Agent': 'FinPilot/1.0 public-price-check' },
        lookup: (_hostname, options, callback) => {
          // Preserve original hostname for Host/TLS while preventing DNS rebinding.
          if (typeof options === 'object' && options.all) callback(null, [{ address: pinned, family: 4 }] as any);
          else callback(null, pinned, 4);
        },
      }, response => {
        if (response.statusCode !== 200 || !/^text\/html(?:;|$)/i.test(String(response.headers['content-type']))) {
          response.destroy(); finish(new Error('OFFER_HTTP_OR_REDIRECT')); return;
        }
        let bytes = 0; const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 1048576) { response.destroy(); finish(new Error('OFFER_RESPONSE_TOO_LARGE')); return; }
          chunks.push(chunk);
        });
        response.on('end', () => finish(undefined, Buffer.concat(chunks).toString('utf8')));
        response.on('error', () => finish(new Error('OFFER_NETWORK_ERROR')));
      });
      req.on('error', () => finish(new Error('OFFER_NETWORK_ERROR'))); req.end();
    }).catch(() => finish(new Error('OFFER_DNS_ERROR')));
  });
}
export function parseSpotify(html: string, observedAt: string): SourcedOffer[] {
  const text = html.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/\s+/g, ' ');
  const match = text.match(/Premium Individual only\.\s*\$0 for 1 month, then \$(\d{1,3})\.(\d{2}) per month after\.\s*Offer only available if you haven't tried Premium before\./i);
  if (!match || !/Ad-free music listening/i.test(text) || !/Offline listening/i.test(text)) return [];
  const price = Number(match[1]) * 100 + Number(match[2]);
  if (!price) return [];
  const terms = `Individual standard renewal $${match[1]}.${match[2]}/month; introductory month requires no previous Premium trial. Taxes may apply; verify at checkout.`;
  return [{ offer: { id: 'spotify-us-individual', provider: 'Spotify', plan: 'Premium Individual', source_url: SOURCE_URL,
    source_mode: 'live', verified_at: observedAt, monthly_equivalent_cents: price, upfront_cents: price,
    eligibility: ['US', 'one account; introductory offer requires no previous Premium trial'], features: ['ad-free music', 'offline listening'],
    promo_end: null, renewal_cents: price, currency: 'USD' }, billing_months: 1, verified: true, country: 'US', accounts: 1,
    terms, terms_sha256: createHash('sha256').update(terms).digest('hex'), promo: { months: 1, price_cents: 0, requires_new_customer: true } }];
}
export function fixtureOffer(): SourcedOffer {
  const terms = 'FICTIONAL DEMO annual music plan. $99 upfront for twelve months, $99 annual renewal. US, one account. Not a purchasable offer.';
  return { offer: { id: 'fixture-music-annual', provider: 'Demo Music', plan: 'Fixture Annual', source_url: null,
    source_mode: 'fixture', verified_at: null, monthly_equivalent_cents: 825, upfront_cents: 9900,
    eligibility: ['US', 'synthetic demonstration only'], features: ['ad-free music', 'offline listening'], promo_end: null, renewal_cents: 9900, currency: 'USD' },
    billing_months: 12, verified: false, country: 'US', accounts: 1, terms,
    terms_sha256: createHash('sha256').update(terms).digest('hex'), promo: null };
}
export async function fetchOffers(signal: AbortSignal, options: { fixtureFallback?: boolean; readPage?: typeof retrievePage; now?: () => Date } = {}): Promise<OfferFetch> {
  const at = (options.now?.() ?? new Date()).toISOString();
  let reason = 'OFFER_UNRECOGNIZED_TERMS';
  try {
    const offers = parseSpotify(await (options.readPage ?? retrievePage)(signal), at);
    signal.throwIfAborted();
    if (offers.length) return { availability: 'available', source_mode: 'live', retrieved_at: at, attempted_at: at, source_url: SOURCE_URL, reason: null, offers };
  } catch { reason = signal.aborted ? 'OFFER_CANCELLED' : 'OFFER_FETCH_FAILED'; }
  if (signal.aborted) throw new Error('OFFER_CANCELLED');
  return { availability: options.fixtureFallback ? 'fixture_fallback' : 'unavailable', source_mode: 'fixture', retrieved_at: null,
    attempted_at: at, source_url: SOURCE_URL, reason, offers: options.fixtureFallback ? [fixtureOffer()] : [] };
}

// Application default respects the existing OFFERS_MODE setting. The acceptance
// script deliberately calls fetchOffers directly to verify the real integration.
export const configuredFetchOffers: typeof fetchOffers = async (signal, options = {}) => {
  signal.throwIfAborted();
  const mode = process.env.OFFERS_MODE ?? 'fixture';
  if (mode === 'live') return fetchOffers(signal, options);
  if (mode !== 'fixture') throw new Error('INVALID_OFFERS_MODE');
  const at = (options.now?.() ?? new Date()).toISOString();
  return { availability: 'fixture_fallback', source_mode: 'fixture', retrieved_at: null,
    attempted_at: at, source_url: SOURCE_URL, reason: 'CONFIGURED_FIXTURE_MODE', offers: [fixtureOffer()] };
};
