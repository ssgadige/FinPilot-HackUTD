"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Card, MetricCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  financeApi,
  FinanceError,
  usd,
  type Indicator,
} from "@/lib/finance-api";
import { useFinanceScope, useFinancialRead } from "./finance-scope";
import { EvidenceDrawer, type EvidenceRecord } from "./evidence-drawer";
import { Commitments, Metadata, ReadState } from "./finance-ui";
import { ForecastPanel } from "./forecast";

const definitions = [
  {
    key: "cash_buffer_months",
    title: "Cash buffer",
    unit: "months",
    formula:
      "Liquid cash ÷ essential monthly spending. Investments, retirement and CDs are excluded.",
  },
  {
    key: "debt_to_income",
    title: "Debt-to-income",
    unit: "percent",
    formula:
      "Observed linked liability payments divided by linked income in the latest complete dataset month, as a percentage. This is not a verified gross-income underwriting ratio.",
  },
  {
    key: "card_utilization",
    title: "Card utilization",
    unit: "percent",
    formula:
      "Eligible revolving card balances ÷ known card limits × 100. Values may exceed 100%.",
  },
] as const;
function Signal({
  definition,
  indicator,
}: {
  definition: (typeof definitions)[number];
  indicator?: Indicator;
}) {
  const available =
    indicator &&
    typeof indicator.value === "number" &&
    indicator.unit === definition.unit &&
    typeof indicator.numerator_cents === "number" &&
    typeof indicator.denominator_cents === "number" &&
    indicator.denominator_cents > 0 &&
    !indicator.missing_inputs?.length;
  return (
    <Card>
      <h3>{definition.title}</h3>
      <p className="signal-value">
        {available
          ? `${indicator.value}${definition.unit === "months" ? " months" : "%"}`
          : "Unavailable"}
      </p>
      <p>{definition.formula}</p>
      <p className="small">
        {available
          ? `Calculation inputs: ${usd(indicator.numerator_cents)} / ${usd(indicator.denominator_cents)}. Result supplied by the service.`
          : "Required calculation inputs or units are missing. No health assessment is available."}
      </p>
      <p className="small">
        {indicator?.explanation ?? "Calculation explanation unavailable."}
      </p>
      <p className="small muted">
        Missing inputs:{" "}
        {indicator?.missing_inputs?.join(", ") ||
          (available ? "None reported" : "Not supplied")}{" "}
        · Source: {indicator?.source_mode ?? "Unavailable"}
      </p>
    </Card>
  );
}
export function OverviewScreen() {
  const { accounts, refresh } = useFinanceScope();
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const result = useFinancialRead("overview", async (signal) => {
    const data = await financeApi.overview(signal);
    if (
      data.upcoming_bills?.some(
        (b) => !accounts.items.some((a) => a.id === b.account_id),
      )
    )
      throw new FinanceError("revoked");
    return data;
  });
  return (
    <div className="page-stack finance-page">
      <PageHeading
        title="A clearer next move starts here"
        description="A financial picture you can inspect, with sources and assumptions in view."
        action={
          <Button variant="secondary" onClick={refresh}>
            Refresh financial data
          </Button>
        }
      />
      {result.data ? (
        <>
          <Metadata meta={result.data} />
          <div className="finance-metrics">
            <MetricCard
              label="Liquid cash"
              value={usd(result.data.liquid_cash_cents)}
              detail="Checking and savings · backend total"
            />
            <MetricCard
              label="Total debt"
              value={usd(result.data.debt_cents)}
              detail="Linked liabilities · backend total"
            />
            <MetricCard
              label="Net worth"
              value={usd(result.data.net_worth_cents)}
              detail="Assets less liabilities · backend total"
            />
          </div>
          <Card className="investment-card">
            <h2>Investments & restricted assets</h2>
            <p className="signal-value">{usd(result.data.investments_cents)}</p>
            <p>
              Displayed separately from liquid cash. Investment, retirement and
              CD balances are not spendable cash by default.
            </p>
          </Card>
          <section aria-labelledby="signals-title">
            <h2 id="signals-title">Your financial signals</h2>
            <p className="muted">
              Descriptive indicators, not credit scores or lending decisions.
              Income assumptions appear in the service explanation.
            </p>
            <div className="finance-signals">
              {definitions.map((d) => (
                <Signal
                  key={d.key}
                  definition={d}
                  indicator={result.data?.indicators?.find(
                    (i) => i.key === d.key,
                  )}
                />
              ))}
            </div>
          </section>
          <Commitments
            title="Upcoming bills"
            items={result.data.upcoming_bills}
            onEvidence={setEvidence}
          />
        </>
      ) : (
        <ReadState {...result} />
      )}
      <div className="finance-columns">
        <ForecastPanel onEvidence={setEvidence} compact />
        <Card>
          <h2>Inspect your account scope</h2>
          <p>
            Transfers stay visible in history. The backend excludes paired owned
            transfers from income and spending, and avoids counting card
            purchases and repayments twice.
          </p>
          <div className="finance-actions">
            {accounts.items.map((account) => (
              <Button
                variant="secondary"
                key={account.id}
                onClick={() => setEvidence({ account })}
              >
                Inspect {account.label}
              </Button>
            ))}
          </div>
          <Link href="/transactions">
            Browse all available transaction history
          </Link>
          <p>
            <Link href="/cash-and-bills">Review your cash calendar</Link>
          </p>
        </Card>
      </div>
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
