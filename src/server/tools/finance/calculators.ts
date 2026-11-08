import Decimal from "decimal.js";
import { calculation, integer } from "./index.ts";
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export function loanCalculation(
  principal_cents: number,
  apr_bps: number,
  months: number,
  extra_payment_cents: number,
) {
  integer(principal_cents, 1, 100_000_000);
  integer(apr_bps, 0, 10000);
  integer(months, 1, 600);
  integer(extra_payment_cents, 0, 100_000_000);
  const principal = new D(principal_cents),
    rate = new D(apr_bps).div(120000);
  const payment_cents = Math.max(
    1,
    Number(
      (rate.isZero()
        ? principal.div(months)
        : principal
            .mul(rate)
            .div(new D(1).minus(new D(1).plus(rate).pow(-months)))
      )
        .toDecimalPlaces(0)
        .toString(),
    ),
  );
  let balance = principal_cents,
    interest_cents = 0,
    total_paid_cents = 0;
  const schedule: {
    month: number;
    payment_cents: number;
    interest_cents: number;
    principal_cents: number;
    balance_cents: number;
  }[] = [];
  for (let month = 1; month <= months && balance > 0; month++) {
    const interest = Number(
      new D(balance).mul(rate).toDecimalPlaces(0).toString(),
    );
    const payment =
      month === months
        ? balance + interest
        : Math.min(payment_cents + extra_payment_cents, balance + interest);
    balance = balance + interest - payment;
    interest_cents += interest;
    total_paid_cents += payment;
    schedule.push({
      month,
      payment_cents: payment,
      interest_cents: interest,
      principal_cents: payment - interest,
      balance_cents: balance,
    });
  }
  return calculation(
    "loan",
    { principal_cents, apr_bps, months, extra_payment_cents },
    {
      payment_cents,
      interest_cents,
      total_paid_cents,
      payoff_months: schedule.length,
      remaining_cents: balance,
      schedule,
    },
    [
      "Hypothetical fixed-rate loan; nominal annual interest rate divided by 12; end-of-month payments; interest rounded half up to cents; final payment clears rounding residual; fees and taxes excluded.",
    ],
  );
}
export function savingsCalculation(
  target_cents: number,
  saved_cents: number,
  months: number,
  apy_bps: number,
) {
  integer(target_cents, 1, 100_000_000);
  integer(saved_cents, 0, 100_000_000);
  integer(months, 1, 600);
  integer(apy_bps, 0, 3000);
  const rate = new D(1)
    .plus(new D(apy_bps).div(10000))
    .pow(new D(1).div(12))
    .minus(1);
  const factor = rate.plus(1).pow(months),
    gap = new D(target_cents).minus(new D(saved_cents).mul(factor));
  const contribution_cents = gap.lte(0)
    ? 0
    : Number(
        (rate.isZero() ? gap.div(months) : gap.mul(rate).div(factor.minus(1)))
          .toDecimalPlaces(0, Decimal.ROUND_CEIL)
          .toString(),
      );
  const projected_cents = Number(
    new D(saved_cents)
      .mul(factor)
      .plus(
        rate.isZero()
          ? new D(contribution_cents).mul(months)
          : new D(contribution_cents).mul(factor.minus(1)).div(rate),
      )
      .toDecimalPlaces(0)
      .toString(),
  );
  return calculation(
    "savings",
    { target_cents, saved_cents, months, apy_bps },
    {
      contribution_cents,
      projected_cents,
      funded: saved_cents >= target_cents,
    },
    [
      "Hypothetical savings calculation; APY converted to an effective monthly rate; end-of-month contributions rounded up to cents; constant yield assumed, not guaranteed; fees and taxes excluded.",
    ],
  );
}
