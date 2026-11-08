# Expanded personal and business demo dataset

Related: FP-09, FP-11, FP-12, FP-19 and FP-20. This is an **opt-in data package**, not completed business-portal or live-offer integration. The existing seed, API/schema contracts, and local database are unchanged.

## Generate and verify

From the repository root, using Python 3 (Windows can use `py -3`):

```sh
python scripts/seed_expanded_demo.py --database data/expanded-v2/finpilot-expanded.sqlite
python -m unittest discover -s tests -p 'test_expanded_seed.py' -v
```

Use a new output directory. The generator refuses existing databases or credential/manifest files. Do not reset the existing login-test database, switch DATABASE_PATH, or import this dataset into the running portal until the integration gates below pass. The command writes a local database, `demo-credentials.json`, and `seed-manifest.json`. These generated files must remain gitignored; do not commit them or feed credentials to agents. The credentials use the existing fictional identities and matching app/institution email convention, with separately salted hashes. No OTP is generated or persisted in a shareable guide.

The file requires `scripts/seed_demo.py` for the existing password hashing helper and `data/schema.sql` as its baseline. It creates new tables and additional liability kinds only in the newly generated database. It does not modify the base schema file.

## Coverage

| User | Institutions | Months | Scenario |
|---|---:|---:|---|
| Maya Chen | 5 | 24 | Car upgrade alongside existing auto debt |
| Jordan Brooks | 8 | 21 | Freelance studio; late invoices, working capital |
| Priya Shah | 6 | 24 | Salary plus consulting; subscriptions and tax reserves |
| Luis Rivera | 6 | 18 | High utilization; car and personal debt |
| Amina Hassan | 7 | 24 | Mortgage, car, investments and emergency cash |
| Ethan Park | 5 | 12 | Student, thin credit file, tuition borrowing |
| Sofia Martinez | 6 | 24 | CD maturity and home repair financing |
| Noah Williams | 5 | 24 | Pension, retirement assets and accessibility costs |
| Zoe Patel | 7 | 18 | Home deposit with auto and student obligations |
| Oliver Reed | 8 | 15 | Retail, payroll, inventory, duplicate vendor charge |

Verified package: **10 users, 63 institution logins, 74 accounts, 9,332 transactions, 3 businesses**. Complete financial months end October 2026; fixture as-of date November 8, 2026. All identities, finances, scores and invoices are synthetic. Real institution names identify local simulators, not integrations or verified products. Private lenders are fictional and clearly named Demo.

## Financial semantics

- Integer USD cents. Asset positive delta adds value; liability positive delta increases debt. Paired transfers have opposite economic signs even when both stored debt-payment entries are negative.
- All balances equal opening balance plus ledger deltas. Liability principal and asset balances are nonnegative; revolving balances stay within limits.
- Account ownership distinguishes personal from business. Business operating cash, processor wallets and designated tax reserves remain separate. Restricted business tax cash must not appear as spendable personal money.
- Business revenue equals paid invoice deposits. Open and overdue invoices are receivables, not cash, and have no receipt transaction. Processor settlements and owner draws are paired transfers, never extra revenue or extra salary.
- Loan interest and payments are separate, with a fixed-rate monthly approximation disclosed in the source. This is simulated amortization, not lender statements. Purchase valuations, escrow, property ownership, collateral appraisals and insurance contracts are not comprehensively modeled; do not claim complete real-world net worth or secured eligibility.
- Monthly business metrics reconcile to cash receipts, operating costs (including business card purchases), interest, debt payments and tax payments. Do not add metrics to ledger totals a second time. These are management/cash-flow fixtures, not audited GAAP accounts. Tax reserves use a fictional 20% cash-allocation assumption, not a tax calculation.
- Oliver's duplicate-charge candidate is retained in both ledger spending and metrics until a human confirms a correction. No silent deduplication.
- Simulated score values have an explicit model/source/date and are **not FICO or bureau data**. No real approval odds or lender decisions are seeded.
- Secondary wallets can be dormant. Deposits accrue synthetic interest; investments contain labeled valuation movements. Not every account needs daily purchases to be realistic.

## Schema additions and integration gates

New account kinds: `personal_loan`, `student_loan`, `business_loan`, `line_of_credit`. Existing kinds remain unchanged for business checking/savings/cards; entity ownership is metadata, not a misleading substitute loan type.

New fixture tables:

| Table | Purpose |
|---|---|
| fixture_entities | Personal/business ownership, industry, formation date and employee count |
| fixture_account_details | Entity, restricted cash, purpose, term and payment |
| fixture_credit_profiles | Explicitly fictional credit history inputs |
| fixture_invoices | Paid, overdue and open customer invoices |
| fixture_monthly_business_metrics | Reconciled management/cash-flow measures |
| fixture_borrowing_goals | Requested amount, purpose, entity and term |

Before using this database in the portal, coordinate these changes with lane B/C:

1. Migrate schema and API enums deliberately; extend frontend adapters and all debt/liability classification in server DB, tool runtime, calculators, tables and evidence. Do not classify an unknown liability as an asset.
2. Add authenticated, connected-account-scoped entity and invoice access. A user owning a business does not automatically authorize all its accounts. Scope child records and avoid returning invoice amounts from disconnected accounts.
3. Add Personal / Business / Combined views. Keep personal spending, business revenue/profit and owner transfers distinct. Combined views eliminate internal owner draws and do not double-count invoices.
4. Extend forecasts with paired owner-draw and processor transfers, business receipts, payroll, taxes, card statements and invoice payment uncertainty. Current legacy scheduled items intentionally do not pretend to provide a complete business forecast. Block an incomplete business forecast until supported.
5. Calculate liquidity excluding restricted tax cash and retirement assets; compute business operating runway and receivable aging separately. Define DSCR and expense treatment explicitly before showing an estimate. No fabricated lender threshold.
6. Finish institution OTP, consent, account selection, persistence across logout, deduplication and confirmed disconnect. All seed connections start unlinked; there is no auth bypass or automatically granted access.
7. Prove ownership, revoked-access denial, reconciliation, new liability handling and scoped evidence with backend/browser tests before changing the running app's database path. Do not close FP-09/11/12 based only on this package.

## Validation evidence

`python -m unittest discover -s tests -p 'test_expanded_seed.py' -v`: 10 tests pass, covering institution count and owned accounts, database integrity/reconciliation, economic transfer signs, mixed histories, entity boundaries, invoice receipts, ledger-derived business metrics, explicit fixture scores, refusal to overwrite outputs, and credential hashing. Legacy seed tests are separate and preserved.
