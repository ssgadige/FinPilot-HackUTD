# Interface specification

## Direction

FinPilot should feel like a professional digital banking application: restrained visual hierarchy, precise financial figures, clear account ownership, and predictable navigation. Its distinctive feature is a financial command center that connects agent findings to account evidence, plan alternatives and user decisions.

Use original composition and licensed assets. Institution names identify simulated providers; never imply an official banking partnership.

## Visual system

| Element | Specification |
|---|---|
| Canvas | Warm neutral #F5F7FA; white content surfaces |
| Navigation | Deep navy #102A43, light text and restrained active indicators |
| Primary action | Teal #087F8C with verified accessible text contrast |
| Financial figures | Tabular numerals, consistent currency/decimal alignment; negatives explicitly signed |
| Typography | Inter or system sans; 14–16px body, 24–32px page titles |
| Spacing | 8px scale, generous gutters, consistent card/table padding |
| Shape | 12px card corners, subtle borders; minimal shadow |
| Status | Text and icon with color; urgent red, caution amber, opportunity teal |
| Motion | Short purposeful transitions; respect reduced-motion preferences |

Contrast-check the final palette, including chart labels and muted text. Avoid decorative gradients, excessive glass effects, rotating agent avatars and large empty cards. Icons should clarify actions.

## Application shell

Desktop: fixed left navigation, page heading and contextual actions, content grid, optional collapsible right chat panel. Keep Run Checkup prominent on Overview and Agent Workspace. Tablet: collapsible rail. Mobile: compact navigation, stacked cards, readable tables with intentional horizontal scrolling. Chat opens as a drawer rather than covering key controls.

Header displays profile, notification status and clear simulation label. Never claim bank-grade security, deposit protection or verified institution connectivity.

## Screen requirements

| Screen | Composition and primary behavior |
|---|---|
| Login and verification | Focused form with brand panel, visible field labels, password visibility toggle, concise verification instructions, resend countdown and accessible errors |
| Overview | Cash/debt/net worth summary; cash forecast as the main chart; prioritized findings alongside; upcoming bills below; assets separate from spendable cash |
| Financial institutions | Category tabs and search; provider tiles with names; connected state/last sync; guided modal for simulator login, consent and account selection |
| Accounts | Professional account cards with masked identifiers; organized by institution/type; select card to see history and evidence |
| Transactions | Dense readable table; sticky filters for date/account/category/search; signed amounts, merchant/category details, pagination and evidence drawer |
| Cash and bills | Timeline/calendar plus projected balance chart; highlight specific collision dates and link the responsible bills/accounts |
| Subscriptions | Monthly/annual cost summary; recurring service list; price-change badges; side-by-side offers with eligibility, renewal price, source and sample/live state |
| Debt and readiness | Debt balance/APR/minimum table; payoff comparison chart; assumptions and cash-buffer constraints adjacent to results |
| Goals and plans | Goal progress, deadline and priority; compare allocation options; explicit selection/acceptance; show tradeoffs and plan version |
| Assets | Savings/CD/IRA/brokerage snapshots; maturity dates and valuation timestamps; no misleading available-to-spend total |
| Agent workspace | Compact role/status rail; central findings feed; expandable real tool events and evidence; dependency handoffs and partial failures visible |
| Scenario lab | Preset scenario controls beside baseline/proposed/stressed results; show minimum balance, shortfall date and changed goal timeline |
| Plan repair | Before/after amounts, changed assumption, reason and evidence; accept or keep previous plan |
| Settings | Profile/security/connected institutions grouped separately; clear logout and disconnect confirmation |

## Reusable components

Application shell, account card, metric card, transaction table, institution tile, status badge, cash chart, evidence drawer, offer comparison, goal progress, plan comparison, confirmation dialog, OTP input and inline notification. Use the same components throughout; agent cards should show real results rather than duplicate dashboard metrics.

## Required states

Every data-driven screen handles loading skeletons, empty/unlinked data, errors with retry, stale/partial records and successful completion. Preserve form input on recoverable errors. Destructive changes need a clear confirmation. Disable only the affected action while it runs.

Keyboard access, visible focus, labels, logical heading order, chart/table alternatives, screen-reader announcements for verification/run status, 200% zoom and reduced-motion behavior are acceptance requirements. Never rely on color alone.

## Review evidence

UI PRs include screenshots at desktop 1440px and mobile 390px plus a brief keyboard check. Verify that financial numbers remain readable, no primary action is clipped, the mock/live status remains visible, and table overflow is usable. The frontend integration issue includes a visual consistency pass before feature freeze.
