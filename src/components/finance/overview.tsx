"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ScanSearch } from "lucide-react";
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
    <article className={`signal${available ? "" : " signal--unavailable"}`}>
      <h3>{definition.title}</h3>
      <p className="signal-value">
        {available
          ? `${new Intl.NumberFormat("en-US", {maximumFractionDigits:definition.unit==="months"?1:2}).format(indicator.value!)}${definition.unit === "months" ? " months" : "%"}`
          : "Unavailable"}
      </p>
      {available && definition.unit === "percent" && (
        <div className="meter" aria-hidden="true">
          <span
            style={{ width: `${Math.min(100, Math.max(0, indicator.value as number))}%` }}
          />
        </div>
      )}
      <details className="signal-details"><summary>How it works</summary>
      <p className="signal-formula">{definition.formula}</p>
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
      </details>
    </article>
  );
}

/** Proportions only; exact amounts are listed in the ledger beside it. */
function Composition({
  liquid,
  invested,
  owed,
}: {
  liquid?: number | null;
  invested?: number | null;
  owed?: number | null;
}) {
  const known = [liquid, invested, owed].every(
    (value) => typeof value === "number" && value >= 0,
  );
  const assets = (liquid ?? 0) + (invested ?? 0);
  if (!known || assets <= 0) return null;
  const pct = (value: number) => `${(value / assets) * 100}%`;
  return (
    <div className="composition" aria-hidden="true">
      <div className="composition-row">
        <span className="composition-label">Assets</span>
        <div className="composition-track">
          <span className="seg seg--liquid" style={{ width: pct(liquid!) }} />
          <span className="seg seg--invested" style={{ width: pct(invested!) }} />
        </div>
      </div>
      <div className="composition-row">
        <span className="composition-label">Owed</span>
        <div className="composition-track">
          <span
            className="seg seg--owed"
            style={{ width: pct(Math.min(owed!, assets)) }}
          />
        </div>
      </div>
      <div className="composition-legend">
        <span><i className="dot dot--liquid" />Spendable cash</span>
        <span><i className="dot dot--invested" />Invested &amp; restricted</span>
        <span><i className="dot dot--owed" />Debt</span>
      </div>
    </div>
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
          <Card className="balance-sheet">
            <div className="balance-head">
              <div className="balance-total">
                <h2>Net worth</h2>
                <p className="balance-value metric-value">
                  {usd(result.data.net_worth_cents)}
                </p>
                <p className="muted small">
                  Assets less liabilities · backend total
                </p>
              </div>
              <Composition
                liquid={result.data.liquid_cash_cents}
                invested={result.data.investments_cents}
                owed={result.data.debt_cents}
              />
            </div>
            <div className="balance-ledger">
              <section className="ledger-cell ledger-cell--liquid">
                <h3>Liquid cash</h3>
                <p className="ledger-value metric-value">
                  {usd(result.data.liquid_cash_cents)}
                </p>
                <p className="muted small">
                  Checking and savings · backend total
                </p>
              </section>
              <section className="ledger-cell ledger-cell--invested investment-card">
                <h3>Investments &amp; restricted assets</h3>
                <p className="ledger-value metric-value">
                  {usd(result.data.investments_cents)}
                </p>
                <p className="muted small">
                  Displayed separately from liquid cash. Investment, retirement
                  and CD balances are not spendable cash by default.
                </p>
              </section>
              <section className="ledger-cell ledger-cell--owed">
                <h3>Total debt</h3>
                <p className="ledger-value metric-value">
                  {usd(result.data.debt_cents)}
                </p>
                <p className="muted small">
                  Linked liabilities · backend total
                </p>
              </section>
            </div>
          </Card>
        </>
      ) : (
        <ReadState {...result} />
      )}
      <div className="finance-columns">
        <ForecastPanel onEvidence={setEvidence} compact />
        <Card className="scope-card">
          <h2>Inspect your account scope</h2>
          <p className="muted">
            Transfers stay visible in history. The backend excludes paired owned
            transfers from income and spending, and avoids counting card
            purchases and repayments twice.
          </p>
          <ul className="scope-list">
            {accounts.items.map((account) => (
              <li key={account.id}>
                <span className="scope-account">
                  <strong>{account.label}</strong>
                  <span className="muted small">
                    {account.kind.replaceAll("_", " ")}
                    {account.last_four ? ` · •••• ${account.last_four}` : ""}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  aria-label={`Inspect ${account.label}`}
                  onClick={() => setEvidence({ account })}
                >
                  <ScanSearch size={15} aria-hidden="true" />
                  Inspect
                </Button>
              </li>
            ))}
          </ul>
          <div className="scope-links">
            <Link href="/transactions">
              Browse all available transaction history
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/cash-and-bills">
              Review your cash calendar
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>
      {result.data && (
        <>
          <Card className="signals-panel" aria-labelledby="signals-title">
            <div>
              <h2 id="signals-title">Your financial signals</h2>
              <p className="muted">
                Descriptive indicators, not credit scores or lending decisions.
                Income assumptions appear in the service explanation.
              </p>
            </div>
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
          </Card>
          <Commitments
            title="Upcoming bills"
            items={result.data.upcoming_bills}
            onEvidence={setEvidence}
          />
        </>
      )}
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
