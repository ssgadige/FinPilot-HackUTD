# Calculator contracts

These conventions are explicit implementation requirements; preset Figma results are illustrative. Unknown data stays unknown. No credit score increase or loan approval is guaranteed.

## Net worth

```json
{
  "id": "CALC-01",
  "name": "Net worth",
  "tasks": "#4, #12, #13",
  "inputs": "Owned asset balances and liability balances in cents; linked scope and valuation timestamps.",
  "formula": "sum(assets) - sum(liabilities)",
  "example": "$26,800 assets - $17,600 liabilities = $9,200",
  "validation": "Preserve negative asset balances. Exclude duplicate imported accounts. Show missing/disconnected data and stale valuations.",
  "outputs": "Net worth, asset total, liability total, included-account evidence."
}
```

## Cash buffer

```json
{
  "id": "CALC-02",
  "name": "Cash buffer",
  "tasks": "#4, #12, #13",
  "inputs": "Liquid cash; essential monthly spending. Same currency and observation window.",
  "formula": "liquid_cash / essential_monthly_spending",
  "example": "$5,400 / $3,000 = 1.80 months",
  "validation": "Missing or zero expenses => unavailable, not infinity. Negative cash produces a negative buffer. Investments/retirement/CD excluded by default.",
  "outputs": "Months of buffer, included cash, spending basis, calculation explanation."
}
```

## Debt-to-income indicator

```json
{
  "id": "CALC-03",
  "name": "Debt-to-income indicator",
  "tasks": "#4, #6, #13, #20",
  "inputs": "Required monthly debt payments; monthly gross income. Explain whether income is observed or assumed.",
  "formula": "required_debt_payments / gross_monthly_income x 100",
  "example": "$900 / $5,000 x 100 = 18.00%",
  "validation": "Zero or unavailable income => unknown. Do not include optional extra payments in required-payment DTI or present a lender approval decision.",
  "outputs": "Percent, numerator, denominator, income assumptions."
}
```

## Card utilization

```json
{
  "id": "CALC-04",
  "name": "Card utilization",
  "tasks": "#6, #13, #20",
  "inputs": "Positive revolving card balances and known credit limits; only eligible linked cards.",
  "formula": "sum(card_balances) / sum(known_card_limits) x 100",
  "example": "$3,600 / $11,250 = 32.00%; $1,250 / $1,000 = 125.00%",
  "validation": "Do not cap at 100%. Missing limits => incomplete/unknown. No predicted credit-score increase or bureau score.",
  "outputs": "Aggregate and per-card utilization with source limits."
}
```

## Fixed-rate loan payment

```json
{
  "id": "CALC-05",
  "name": "Fixed-rate loan payment",
  "tasks": "#6, #13, #20",
  "inputs": "Principal P; nominal annual interest rate; whole months n; end-of-month payment timing. Fees financed into principal if included.",
  "formula": "r = annual_rate / 12; A = P*r / (1-(1+r)^(-n)); at r=0, A=P/n",
  "example": "$10,000 at 6% nominal annual rate over 36 months => $304.22 regular payment",
  "validation": "APR can include fees; do not confuse it with the interest accrual rate. Reject negative or non-finite values and invalid terms. Schedule convention is monthly, not actual daily-interest lender accounting.",
  "outputs": "Payment and clearly labeled schedule assumptions; no offer/approval."
}
```

## Amortization and extra payments

```json
{
  "id": "CALC-06",
  "name": "Amortization and extra payments",
  "tasks": "#6, #13, #20",
  "inputs": "Loan inputs, extra monthly payment and rounding convention. This reference models one fixed-rate obligation; a portfolio strategy must also enforce minimums and shared cash limits.",
  "formula": "interest_t = round(balance_(t-1)*r); principal_t=payment_t-interest_t; balance_t=balance_(t-1)-principal_t",
  "example": "$10,000 / 6% / 36 months: month 1 interest $50, principal $254.22; final payment $304.18; total interest $951.88",
  "validation": "Round posted amounts half-up to cents. Cap final payment at balance plus interest; reject non-amortizing payment. Never overpay below zero. Document residual adjustment.",
  "outputs": "Principal/interest/payment/balance by period; payoff date; total interest; extra-payment comparison."
}
```

## Savings goal contribution

```json
{
  "id": "CALC-07",
  "name": "Savings goal contribution",
  "tasks": "#6, #13, #20",
  "inputs": "Target T, current savings S, months n, APY a, end-of-month contributions. Separate required contribution from budget feasibility.",
  "formula": "r=(1+a)^(1/12)-1; C=max(0,(T-S*(1+r)^n)*r/((1+r)^n-1)); at r=0, C=max(0,(T-S)/n)",
  "example": "($8,000-$2,400)/12 => $466.67 recurring; $466.63 final contribution to hit exactly $8,000",
  "validation": "Round required recurring amount up to a cent. Already funded => $0. Reject nonpositive horizon. APY is a decimal in the formula (5%=0.05). Future yields are assumptions.",
  "outputs": "Required contribution, feasibility gap, contribution schedule and target timeline."
}
```

## APY / CD illustration

```json
{
  "id": "CALC-08",
  "name": "APY / CD illustration",
  "tasks": "#6, #13, #20",
  "inputs": "Principal P, APY a, years t; maturity and withdrawal constraints shown separately.",
  "formula": "future_value = P*(1+a)^t",
  "example": "$1,000 at 5% APY for one year => $1,050 before taxes or penalties",
  "validation": "APY already incorporates compounding; do not divide APY by 12 as a nominal rate. This illustration excludes tiered/stepped rates, withdrawals, penalties and taxes unless explicitly supplied.",
  "outputs": "Projected value, interest amount, maturity context and restricted-cash warning."
}
```

## Subscription normalization

```json
{
  "id": "CALC-09",
  "name": "Subscription normalization",
  "tasks": "#5, #13, #19",
  "inputs": "Charge amount, cadence and currency; distinguish monthly equivalent from actual payment due.",
  "formula": "annual /12; quarterly /3; monthly unchanged; weekly *52/12 (explicit 52-week convention)",
  "example": "$189.96 annual => $15.83/month equivalent, with $189.96 upfront",
  "validation": "Use observed billing cadence; weekly estimate is not exact calendar-year cash timing. Missing cadence/currency => needs confirmation. Do not infer usage from payments.",
  "outputs": "Monthly equivalent, actual charge, next billing date and annual cost basis."
}
```

## Offer comparison / first-year cost

```json
{
  "id": "CALC-10",
  "name": "Offer comparison / first-year cost",
  "tasks": "#5, #13, #14, #19",
  "inputs": "Comparable features, eligibility, promo months/price, standard price, upfront fee, switching fee, taxes when known and renewal terms.",
  "formula": "first_year = promo_months*promo_price + (12-promo_months)*standard_price + known_upfront + known_fees",
  "example": "Current $18.99 x12 = $227.88; annual sample $189.96 => conditional difference $37.92",
  "validation": "Unknown taxes/fees stay unknown. Promo horizon must be 0-12 whole months. Never count cancel and switch savings twice. Future subscription savings remain conditional until confirmed.",
  "outputs": "First-year and renewal cost, upfront affordability, source URL/time, feature differences and conditional savings."
}
```

## Budget allocation conservation

```json
{
  "id": "CALC-11",
  "name": "Budget allocation conservation",
  "tasks": "#6, #13, #14, #20",
  "inputs": "Income, essential commitments, required debt payments, confirmed savings changes, protected reserves and candidate allocations.",
  "formula": "available = income - required_commitments; feasible iff total_optional_allocations <= available",
  "example": "$5,200-$3,500-$300=$1,400; $400 extra debt + $1,000 goal = $1,400",
  "validation": "Do not deduct the same debt/bill twice. Do not count unconfirmed savings. Reject negative allocations; negative available cash means infeasible. Preserve the selected cash-floor policy.",
  "outputs": "Available, allocated, unallocated, infeasible gap and goal/debt tradeoffs."
}
```

## Dated forecast and stress test

```json
{
  "id": "CALC-12",
  "name": "Dated forecast and stress test",
  "tasks": "#4, #6, #13, #18, #21, #22",
  "inputs": "Opening balance per account, unique dated signed events, as-of date, horizon and scenario changes; connection/snapshot scope fixed.",
  "formula": "balance_d = opening + cumulative daily net events; stress adds/removes/moves the selected event exactly once",
  "example": "$350 - $1,250 on Nov 10 => -$900; +$2,600 on Nov 15 => $1,700. A $900 expense reduces a $1,200 minimum to $300.",
  "validation": "Reference aggregates same-day events for end-of-day balances; disclose that intraday settlement order can differ. Transfer pairs do not become income. A buffer breach is not the same as cash below zero. Delayed income moves an event, not duplicates it.",
  "outputs": "Dated balances, minimum, first negative date, first buffer breach, baseline/stress differences and impacted plan assumptions."
}
```

## Primary references

- [CFPB: interest rate and APR](https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-a-loan-interest-rate-and-the-apr-en-733/)
- [Regulation DD Appendix A: APY](https://www.consumerfinance.gov/rules-policy/regulations/1030/a/)
