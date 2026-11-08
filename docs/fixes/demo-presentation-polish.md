# Demo dashboards and presentation polish

Local task branch: `fix/demo-dashboards-and-presentation-polish`.

## Requested demo setup

The operator explicitly requested all ten existing users have seven account types and preloaded dashboards, rather than manually linking each institution for the presentation. Applied to the existing `data/finpilot-login-test.sqlite`, after testing on an isolated consistent copy. No database reset, user registration, password change, session bypass or replacement seed.

All ten now have checking, savings, a credit card, brokerage, IRA, CD and an auto loan or existing mortgage. Sofia retains her original extra checking account: 71 accounts total, seven distinct types per user. There are 13,322 transactions with the installed 30-month history retained and coherent histories added for the new types. Loan payment transfers have both owned sides; balances reconcile to opening balance plus ledger deltas. CD maturity dates are present. Existing transaction entries and login credentials are retained. Additional loan repayments update savings balances through their paired ledger entries, rather than editing arbitrary balances.

`python scripts/prepare_demo_dashboards.py --database <existing-path> --expand-account-types` inspects without changing data. Adding `--apply` creates a consistent private SQLite backup before mutation, expands only recognized demo users, and provisions their installed account access. Repeating it is idempotent. This is explicit offline presentation provisioning with `demo-presentation-v1` consent, not a public API or an authentication grant. Normal login/Mailpit verification, ownership, CSRF, institution OTP and disconnect protections remain intact. Disconnect is not automatically undone by the application.

Backups are in ignored `data/backups/`; no database, credentials, mailbox contents or environment files are included in source control.

## UI and non-AI behavior

- Navy banking shell, quieter surfaces, concise descriptions and fewer developer controls. Shared UI/settings links and the unavailable notification indicator are removed from customer navigation; routes/security are unchanged.
- Data-source details and financial formulas are available on demand. One discreet fictional-data disclosure remains; there is no claim of PNC affiliation or live banking data.
- Clean account labels without repeated simulation suffixes; cash/retirement/investment distinctions remain visible. Financial ratios use readable display precision and amounts are clearly labeled.
- Disabled scaffold decision buttons replaced with working account navigation and popup-chat launch.
- Accessible floating assistant on authenticated pages, with focus containment, Escape/close and focus restoration. It uses only the existing authenticated chat endpoint. No model configuration, prompts or chatbot backend are replaced. Missing Nemotron returns an honest unavailable message, retains the draft and invents no assistant reply. Account revocation/user changes clear conversation state; no browser storage is used.
- Existing preference, goal, payment comparison, forecast, scenario, evidence and disconnect workflows remain implemented. AI-generated checkups and plan proposals remain dependent on configured Nemotron; no execution is fabricated.

## Verification

- Real Chromium and fresh Mailpit verification for **all ten users**, against the active database. Every user has seven account types through the authenticated API. Accounts, overview, transactions, 30/90-day forecast, subscriptions, goals, debts and plans endpoints returned successfully. Cross-user account access returned 404; each logout revoked its session.
- Maya's eight financial screens rendered without schema errors; popup chat exposed the actual unavailable-provider result.
- Balance reconciliation and foreign-key checks passed; expansion/idempotency and credential preservation have a regression test.
- 76 component/session tests, 29 backend tests and 25 Chromium tests passed. Typecheck, production build and changed-file lint passed. Existing unrelated full-repository lint debt is outside this change.
- Desktop/mobile screenshots under `docs/fixes/evidence/presentation/` are real browser sessions with synthetic presentation records, not network fixtures. Earlier task fixture screenshots are preserved.

Remaining AI limitation: Nemotron credentials/model settings are not configured locally. Chat popup is present; AI answers, agent checkups and new AI plan proposals cannot be claimed working until that configuration is supplied. Existing no-bank-action boundaries remain: proposals never execute transfers, merchant cancellations or purchases.
