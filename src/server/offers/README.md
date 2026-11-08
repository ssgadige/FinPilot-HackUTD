# FP-19 — subscriptions, deals and public offer source

Implements #19 on `feat/fp-19-subscription-and-deal-scout-agents-with-source-adapter`.
The shared FP-18 runtime now supports Subscription Detective and Deal Scout.
Shared API/types remain unchanged; all new snapshot/offer metadata is server-only.

## Verification

```sh
node --test tests/subscriptions.test.ts tests/agent-runtime.test.ts tests/nemotron.test.ts
node --env-file-if-exists=.env scripts/smoke-subscriptions.ts --record
```

The smoke deliberately verifies **live NVIDIA inference and live public retrieval**
against a **fixture financial snapshot**. There is no mocked inference fallback.
It asserts a recurring price finding and a tool-supported price/savings comparison,
then saves the full safe trace in `acceptance.json` only on success. Failed runs
exit nonzero without overwriting prior evidence. Nothing is purchased or canceled.

## Tools and data boundary

| Role | Tools |
| --- | --- |
| subscription-detective | detect_recurring, get_merchant_history, normalize_subscription_cost |
| deal-scout | get_subscription_preferences, fetch_allowlisted_offers, compare_offer_costs |

Use `createSubscriptionTools(loadSnapshot)` with a server-owned loader. Construct
one registry and one shared RunBudget per checkup. Tools accept only
`{ "scope": "snapshot" }`; identity, account selection, subscription IDs and URLs
are never model-selected. Every invocation rechecks snapshot/user scope, connected
selected accounts and ownership of both transaction and subscription child rows.
No database access is added here; the authenticated backend and broader FP-13
library remain separate integration work. The loader must recheck current consent
on each read and project only minimal fields, never credentials or OTPs.

`runSubscriptions` uses the existing Subscription Detective prompt. `runDeals`
requires its completed/needs-information dependency for the same user, run,
snapshot and account selection. The dependency is untrusted data. Both use the
shared immutable context, result/evidence/cents validation, exactly one output
repair, safe events and bounded execution. If no verified comparable offer exists,
`needs_information` with nonempty `missing_data` is enforced by the runtime; an
unsupported claim of completion fails validation.

Recurring detection requires three monthly charges 25–35 days apart or two annual
charges 350–380 days apart, with a recent charge. Credit-card charges use positive
deltas; checking/savings/wallet charges use negative deltas. Refunds and transfers are excluded.
Annual normalization rounds up to an integer cent for display while annual cost
comparison preserves the actual upfront charge. Price increases and category
overlaps are candidates; transaction data never establishes that a service is
unused. Confirmation, usage and keep preferences remain explicit.

## Source configuration and network safety

Application retrieval honors `OFFERS_MODE=fixture|live` (default `fixture`). In
fixture mode no network request occurs, all price evidence is fictional/unverified,
and no verified available savings can be claimed. Set `OFFERS_MODE=live` for the
production loader to retrieve public pricing. An explicit `fixtureFallback: true`
registry option enables labeled demo fallback on failure; otherwise failure
returns unavailable with no offers. The acceptance smoke intentionally tests the
live adapter directly regardless of the application fixture setting.

The only destination is the fixed HTTPS URL
https://www.spotify.com/us/premium/ . There is no URL parameter or arbitrary
fetch tool. DNS is resolved to IPv4, every answer is checked against private,
loopback, link-local, carrier-grade NAT, reserved and multicast ranges, and the
validated IP is pinned into the HTTPS connection. The original hostname remains
in Host/TLS verification. IPv6 and IPv4-mapped IPv6 are rejected. Proxy environment
variables are unused. All redirects are rejected, including redirects to private
hosts. DNS plus transfer is bounded to ten seconds, HTML to 1 MiB, and HTTP status
must be 200 with an HTML content type. No cookies, authorization headers or user
financial data are sent to the source.

Parsing removes scripts/styles and projects only a recognized Individual price,
features and eligibility summary. Changed/unrecognized terms return uncertainty,
never a guessed price. Retrieved HTML is never executed or sent to the model.
Offer evidence includes source URL, retrieval time, renewal/upfront price,
eligibility, features, source mode and a hash of normalized parsed terms. The
hash identifies the parsed terms, not the entire source page. No fictitious
verified timestamp is attached to fallback offers.

## Comparable costs and uncertainty

The deterministic comparison requires confirmed usage/keep preferences, matching
US/account eligibility, all required features, verified recent live price evidence,
known renewal and supported billing terms. Annual plans expose the whole upfront
payment and require an adequate confirmed upfront budget. The fictional annual
fixture tests these branches but is never comparable as an available live offer.

Monthly first-year cost is the initial charge plus eleven renewals; annual cost
is the full upfront payment. A promo can change the calculation only with confirmed
eligibility and a known unexpired promo end. The real parser conservatively excludes
its introductory discount because no expiry was verified. Standard renewal is
used and the exclusion is explained. Every tool supplies deterministic dollar displays alongside integer cents. The runtime rejects dollar prose that does not match known cent amounts, preventing 100x formatting errors. Monthly potential savings are the annual
potential divided by twelve, rounded down to a whole cent. Tax differences remain
unverified and comparisons are explicitly estimates before taxes; final terms and
user choice still require review. No potential savings are marked realized.

Unknown eligibility/features/usage, unconfirmed subscriptions, stale verification,
failed retrieval or no supported equivalent produce uncertainty, not a fabricated
offer. Offer evidence can be live while financial calculation evidence is fixture;
the separate labels are preserved in tool traces and results. Full semantic prose
checking and route/storage integration remain their owning tasks.

For `nvidia/nemotron-3.5-super-vl-120b-a12b`, the two new roles use the documented
`reasoning_effort=none` setting to preserve the 4096-token output budget. Other
model IDs receive no undocumented override. The adapter rejects that optional
setting on models whose protocol has not been verified. Reference:
https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3_5-super-vl-120b-a12b-infer

Request review before merging this task branch to main.
