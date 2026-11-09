# Fresh loan and card comparison — implementation contract

Extends Deal Scout with Debt and Purchase Readiness; Nemotron remains the planner/explainer. **Specification only: no live search provider or lender-prequalification integration is implemented by this data PR.** Do not show a working Live badge until the evidence below exists.

## Every explicit comparison starts a new retrieval

On each new user request, create a server-scoped run using the current authorized snapshot, borrowing purpose/amount/term and Personal or Business entity. A retry with the same idempotency key must reuse the same run, not duplicate network calls. A genuinely new request uses a new key and performs new external searches and issuer-page fetches. Nemotron memory, a fixture catalog and an old search snippet are not fresh market evidence.

The server needs a configured search API and official provider fetch adapters; an NVIDIA key alone does not provide web search. Keep all keys server-side. Use a bounded, institution/issuer-domain allowlist; guard SSRF, redirects, response sizes and timeouts. Never put a user's name, email, exact statement, credentials or credit score into a public search query. Search by product/category/state and generic terms; apply private matching locally. Retrieved pages are untrusted data, not model instructions.

Search discovery is followed by direct verification of the official product page/API. Capture source URL, requested/retrieved timestamps, original effective date if available, expiry, assumptions, location eligibility, product availability, introductory and ongoing terms and whether APR is an advertised range or a personalized quote. Fetch time is not proof that a lender changed its rates today. Missing terms remain unknown. Label a 304 revalidation distinctly from a newly downloaded body. Cached or fixture fallback is opt-in and visibly labeled; it cannot satisfy a fresh-only comparison. If a provider fails, return partial coverage/unavailable rather than inventing results.

## Multi-step tool workflow

1. Coordinator selects Deal Scout and Debt Readiness; reads only connected/selected accounts and consented entity data. Ask for missing gross income, purpose, target amount or term when needed.
2. Deal Scout searches and fetches official terms, validates comparability, extracts structured fields with evidence, and rejects unsupported claims. Use a dedicated structured schema for loans/cards; the existing subscription Offer type is insufficient.
3. Deterministic tools compute loan payment/total cost, fees and APR assumptions, card first-year and ongoing value, bonus-spend feasibility and balance-transfer cost. Model arithmetic is not authoritative.
4. Debt Readiness computes an affordable borrowing estimate under explicit cash-buffer, income and stress assumptions. Use gross income for DTI only when known; never substitute net payroll unnoticed. Business analysis uses business cash flow, existing debt service, time in business, industry and entity-specific inputs; owner draws are not revenue. Lender-specific DSCR/DTI criteria must come from published terms or a supported integration, not a universal invented threshold.
5. Where an actual lender prequalification API is available and the user has explicitly authorized that step, request it with the required consent and report its returned amount/rate/expiry/conditions. Do not claim a search engine can return a personalized underwriting result.
6. Stress-Test checks lower income, delayed invoices, rate changes for variable-rate products and existing obligations. Coordinator ranks only checked offers and explains evidence, gaps and next steps. It can conclude that applying now is not supported by the available information.

## Amount and eligibility display

Show these as separate fields, not one badge:

| Field | Meaning |
|---|---|
| Requested amount | User's stated financing need |
| Published product range | Advertised minimum/maximum; not an approval |
| Estimated affordable amount | Deterministic planning estimate with disclosed assumptions |
| Lender-returned amount | Only present after an authorized supported lender result |
| Funding gap | Requested amount minus the specifically labeled estimate or lender result |
| Eligibility status | Matches known published criteria / does not match / unknown |
| Lender status | Not checked / conditional prequalification / declined / expired, only as actually returned |

For fixed monthly rate `r`, term `n` and affordable payment `P`, principal capacity is `P * (1-(1+r)^(-n))/r`; at zero rate it is `P*n`. Apply fees and down payment separately, use Decimal/integer money and bound inputs. This is affordability, not an approved credit limit. Card credit limits cannot be inferred from a public bonus offer or score.

Do not say “qualified for the full amount” or “approved for a partial amount” based solely on score, DTI, advertised maximum or model judgment. Actual lending decisions can change after verification. Make a useful recommendation without fabricating a guarantee, probability or personalized rate.

## Comparison metrics

Loans: amount range, term, APR/rate range, fixed/variable, origination/prepayment fees, payment range, total repayment, collateral/security, geography, membership, income/document requirements and quote conditions. Mortgages additionally need down payment, property, taxes/insurance/escrow and official Loan Estimates to make a meaningful comparison.

Cards: annual fee, introductory and ongoing APR, promo duration, transfer fee, rewards by observed spending category, caps/exclusions, bonus requirements and deadlines, existing-customer restrictions and first-year versus recurring value. Do not encourage extra spending just to earn a bonus.

Business financing: entity, permitted use, industry/operating geography, time in business, revenue history, existing debt, cash-flow evidence, collateral/personal-guarantee requirements, requested term and costs. Factoring/merchant cash advances must not be compared using a factor rate as if it were APR; mark non-comparable terms and compute an annualized equivalent only with sufficient timing data and disclosed assumptions.

## UI and acceptance evidence

Display `Checked at`, source links, number of providers checked, failed sources, data gaps and a side-by-side comparison. Show “Best among checked offers,” without claiming exhaustive market coverage. Automatically perform authorized read-only analysis; applying, credit pulls and lender data submission require distinct user consent. No automatic account opening or application.

Acceptance: two new requests produce two new external retrieval traces; retries do not duplicate a run; stale source/expired promotion/missing APR/failed provider/unsupported lender API give honest states; personal/business ownership and disconnection are enforced; cross-user evidence is denied; amounts reconcile; no protected traits or fabricated odds enter ranking; fixtures/replays are labeled; real provider key missing means unavailable.

Sources verified November 8, 2026:
- CFPB preapproval: https://www.consumerfinance.gov/owning-a-home/explore/get-a-preapproval-letter/
- CFPB prequalification terminology: https://www.consumerfinance.gov/ask-cfpb/whats-the-difference-between-a-prequalification-letter-and-a-preapproval-letter-en-127/
- SBA 7(a) eligibility: https://www.sba.gov/loans/7a-loans/

## Eligibility signals and existing-card benefits

Use human-readable signals such as “Matches the requirements we could verify,” “Published requirement not met,” and “More information needed.” Explain the actual supporting and blocking factors. Do not invent numerical approval probabilities or say a score proves full/partial approval. A requested-versus-affordable funding gap is a planning estimate, not a lender offer.

An existing-card benefit scan must identify the **exact card product and country/version**, not merely Amex/Chase/Discover as issuer. Current seed cards do not identify exact real products or personalized entitlements. Until confirmed, show “Confirm card product to check benefits.”

For a known card, freshly retrieve official terms and show:
- Statement-credit categories, caps, reset periods, expiration, qualifying merchants/channels and exclusions.
- Enrollment requirements/status; do not assume an offer is activated.
- Category reward rates/caps and existing-card comparisons for already planned spending.
- Relevant travel/protection benefits and conditions; do not promise claim approval.
- Issuer-confirmed remaining allowance/usage, or “Remaining usage unknown” when unavailable. A posted purchase or missing credit in the transaction ledger alone does not establish remaining entitlement.
- Evidence source/time and personal/business account scope. Targeted offers require issuer-authorized account-level evidence; public offers are discovery candidates only.

Prioritize existing benefits that fit the user's normal spending before recommending a new card. Do not add theoretical benefit caps together as guaranteed savings or recommend extra purchases solely to exhaust credits. Pending credits, returns, shared authorized-user caps and expiry need explicit treatment. Never collect/store PAN, CVV or real issuer passwords.

Official issuer reference: https://www.americanexpress.com/en-us/benefits/offers/partner-terms/ (verified November 8, 2026). Eligibility, enrollment and purchase conditions vary by account and offer; this is not a catalog of benefits for every linked card.

## Strict read-only boundary

This capability only retrieves, calculates, compares and explains. It has **no authority or endpoint** to transfer funds, initiate ACH/wires, pay a bill/card, process a purchase, change autopay/payment methods, redeem rewards, enroll in benefits, execute a balance transfer, submit a credit application or initiate a credit pull. It may show the official issuer source for the user to review independently. Even if the model requests one of these operations, the runtime must reject it rather than execute it.

Do not add financial mutation tools to the role registry. Account linking/disconnection and FinPilot authentication remain separate consent/session features; linking grants analysis access, not payment authority. Institution integrations must use read-only scopes. No payment SDK, money-movement credential or payment processor is required.

## Implemented assessment foundation — not a live agent

`src/server/agents/planning/offer-readiness.ts` adds pure deterministic helpers for fresh official-source checks, published-criteria matching, planning funding gaps and existing-card benefit visibility. It never returns approval odds, an approved amount or redemption/enrollment authority. Benefits require confirmed product, applicable enrollment, authorized account and fresh issuer-level usage evidence before showing a confirmed remaining amount.

`tests/backend/offer-readonly.test.ts`: eight focused tests pass with `node --test tests/backend/offer-readonly.test.ts` on Node 24. These test helpers, not production provider integrations. Full app build/lint/browser tests have not been run for this addition.

Remaining runtime work: configured search/official-source adapters, product/benefit data adapters, authenticated context loaders with consent rechecks, role tool registration, evidence persistence, UI and end-to-end rejection tests for prohibited actions. The pure helpers do not enforce authorization for the whole application or make the feature live by themselves.
