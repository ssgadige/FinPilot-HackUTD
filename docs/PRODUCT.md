# Product and frontend specification

## Promise

Bring financial records into one place, find hidden conflicts, compare possible next steps, and maintain a plan as circumstances change. Financial health means clarity and actionable planning; avoid a fabricated authoritative overall credit or health score.

## Navigation and sections

| Section | Content and working interaction |
|---|---|
| Overview | Liquid cash, total debt, net worth snapshot, 30-day cash forecast, upcoming bills, priority actions, Run Checkup |
| Financial institutions | Category cards → provider grid → clearly marked simulator login → consent and account selection → sync result; connected status, last sync, disconnect |
| Accounts and transactions | Provider/account filters, date/category/search filters, 30-month history, pagination, transaction evidence drawer |
| Cash and bills | Income/bill calendar, predicted lowest cash date, cash-collision findings, proposed adjustments |
| Subscriptions | Recurring charges, price changes, overlapping services, user-confirmed usage preferences, compare offers, cancellation guidance and saved action |
| Debt and credit readiness | Cards/loans, APR and utilization from explicit data, payoff scenarios, assumptions; no predicted exact credit-score gains |
| Goals and plans | Goal amount/deadline/priority/minimum cash buffer, competing allocations, compare/select plan, checklist and progress |
| Savings and investments | Savings balances, CD maturity dates, IRA/brokerage snapshots; include in net worth but exclude from spendable cash by default |
| Agent workspace | Nine agent cards, run status and dependency chain, actual tool calls, findings/evidence, partial failures, rerun |
| Scenario lab | Delayed paycheck, surprise expense, reduced income; compare baseline/proposal/stress results |
| Settings and security | Profile, verification destination status, sessions/logout, consent, connection disconnect, simulation labels |
| Chat | Persistent side panel; asks for data, starts selected workflow, explains saved findings; never sees credentials |

## Institution categories

Banks / credit unions: PNC, Bank of America, Chase, Capital One, Ally.
Credit cards: American Express, Discover (bank-issued credit cards can remain under their issuing bank).
Investments / retirement: Fidelity, Vanguard.
Loans / mortgages: Demo Auto Finance, Demo Mortgage.
Digital wallets: PayPal.

Use text labels or licensed assets; no implication of partnership. Each provider is simulated. A user may have different accounts at the same provider. Existing demo users start with unlinked institution data; only selected, consented accounts become visible to agents. Ownership must be verified on every link request.

## Linking flow

Choose category → provider → prominent 'Simulation: do not enter real bank credentials' notice → enter fictional institution username/password → validate against a separate simulator auth table → consent to read balances/history for chosen accounts → server issues an opaque demo connection ID → import/access history → refresh dashboard. Disconnect removes future data access and makes related plans stale. Reconnecting must not duplicate transactions.

## Financial health indicators

Cash buffer in days or months of essential expenses; debt payment / income ratio with calculation shown; card utilization from seeded limits and balances. Add missing-data badges when a denominator or limit is unavailable. These are descriptive app indicators, not credit bureau scores.

## Subscription behavior

Detect candidates from repeated merchant payments, label confidence, and let the user confirm cadence/usage. Transaction records cannot prove a subscription is unused. Compare equivalent plans including features, eligibility, billing term, taxes/fees when known, promotional expiry, annual upfront cost, cancellation conditions and verification time. Never count both cancellation and switching savings for the same service. No automated purchase/cancel. Saving an intention is not realized savings; only confirmed changes affect the accepted future plan.

## Design direction

Clean desktop-first layout with responsive navigation; navy/white base, teal for opportunity, amber for uncertainty, red for urgent cash shortfall. Use accessible contrast, keyboard navigation, labeled forms, focus states and non-color status indicators. Three-person build favors a shared card/table/drawer system. Every primary section needs real data or a clear empty/unavailable state.

## Honest scope

Complete means the scoped demo journey works end to end. It does not mean every function of a real bank. Payments, transfers, account opening, bureau pulls, investment recommendations/trading, tax filing and mortgage underwriting are outside the 14-hour build. Investment/CD/IRA summaries cover visibility; specialized planning is later work.
