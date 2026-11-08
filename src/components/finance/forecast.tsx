"use client";
import { useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { ChartWrapper } from "@/components/ui/chart-wrapper";
import { DataTable } from "@/components/ui/data-table";
import { SelectField } from "@/components/ui/form-field";
import { financeApi, FinanceError, usd } from "@/lib/finance-api";
import { useFinanceScope, useFinancialRead } from "./finance-scope";
import { EvidenceDrawer, type EvidenceRecord } from "./evidence-drawer";
import { Commitments, Metadata, ReadState } from "./finance-ui";

export function ForecastPanel({
  onEvidence,
  compact = false,
}: {
  onEvidence: (record: EvidenceRecord) => void;
  compact?: boolean;
}) {
  const [days, setDays] = useState<30 | 90>(30);
  // useId() contains ":"/"«" which break SVG url(#…) references.
  const gradientId = `forecast-fill-${useId().replace(/[^\w-]/g, "")}`;
  const { accounts } = useFinanceScope();
  const result = useFinancialRead(`forecast:${days}`, async (signal) => {
    const data = await financeApi.forecast(days, signal);
    if (data.balances.length && !data.account_ids.length)
      throw new FinanceError("contract");
    if (
      data.account_ids.some((id) => !accounts.items.some((a) => a.id === id)) ||
      data.events.some((e) => !data.account_ids.includes(e.account_id))
    )
      throw new FinanceError("revoked");
    return data;
  });
  const data = result.data;
  const values = data?.balances.map((b) => b.balance_cents) ?? [];
  // Display geometry only: values and dates come directly from the forecast tool.
  const min = Math.min(...values),
    max = Math.max(...values);
  const times = data?.balances.map((b) => Date.parse(b.date)) ?? [];
  const firstTime = Math.min(...times),
    lastTime = Math.max(...times);
  const x = (date: string) =>
    80 +
    ((Date.parse(date) - firstTime) / Math.max(1, lastTime - firstTime)) * 600;
  const y = (value: number) =>
    170 - ((value - min) / Math.max(1, max - min)) * 140;
  const coordinates = data?.balances
    .map((b) => `${x(b.date)},${y(b.balance_cents)}`)
    .join(" ");
  const area =
    data && data.balances.length
      ? `M${x(data.balances[0].date)},170 L${coordinates?.replaceAll(" ", " L")} L${x(data.balances.at(-1)!.date)},170 Z`
      : "";
  const lowest = data?.balances.reduce<(typeof data.balances)[number] | null>(
    (low, b) => (!low || b.balance_cents < low.balance_cents ? b : low),
    null,
  );
  const zeroY = min < 0 && max > 0 ? y(0) : null;
  return (
    <section className="page-stack" aria-label="Cash forecast">
      <Card>
        <div className="finance-toolbar">
          <h2>Dated cash forecast</h2>
          <SelectField
            label="Forecast horizon"
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as 30 | 90)}
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </SelectField>
        </div>
        {!data ? (
          <ReadState {...result} />
        ) : (
          <>
            <Metadata meta={data} />
            <p>
              <strong>Account scope:</strong>{" "}
              {data.account_ids
                .map((id) => accounts.items.find((a) => a.id === id)?.label)
                .join(", ") || "No accounts included"}
              . Savings do not automatically cover checking obligations.
            </p>
            <div className="forecast-warning">
              <TriangleAlert size={17} aria-hidden="true" />
              <p>
                <strong>Low-cash date:</strong>{" "}
                {data.low_cash_date ?? "None reported"}.{" "}
                {data.low_cash_explanation ??
                  "The service has not supplied a low-cash explanation or threshold. Absence of a date is not a healthy-cash assessment."}
              </p>
            </div>
            <ChartWrapper
              title="Projected end-of-day balances"
              description="Projected balances, not posted transactions. Only dates returned by the service are shown; the line connects those observations."
              dataTable={
                <DataTable
                  caption="Dated projected balances"
                  rows={data.balances}
                  rowKey={(b) => b.date}
                  emptyMessage="No dated forecast records returned."
                  columns={[
                    {
                      key: "date",
                      label: "Projected date",
                      render: (b) => b.date,
                    },
                    {
                      key: "balance",
                      label: "Projected balance",
                      numeric: true,
                      render: (b) => usd(b.balance_cents),
                    },
                  ]}
                />
              }
            >
              {values.length ? (
                <svg
                  viewBox="0 0 700 210"
                  role="img"
                  aria-label="Projected balance trend. Exact dates and USD amounts are available in View chart data."
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M80 30H680 M80 100H680 M80 170H680"
                    className="forecast-grid"
                  />
                  {zeroY !== null && (
                    <path d={`M80 ${zeroY}H680`} className="forecast-zero" />
                  )}
                  <path d={area} fill={`url(#${gradientId})`} />
                  <polyline
                    points={coordinates}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="forecast-line"
                  />
                  <g className="forecast-axis">
                    <text x="2" y="34">
                      {usd(max)}
                    </text>
                    <text x="2" y="174">
                      {usd(min)}
                    </text>
                    <text x="80" y="200">
                      {data.balances[0].date}
                    </text>
                    <text x="680" y="200" textAnchor="end">
                      {data.balances.at(-1)?.date}
                    </text>
                  </g>
                  {data.balances.map((b) => (
                    <circle
                      key={b.date}
                      cx={x(b.date)}
                      cy={y(b.balance_cents)}
                      className={
                        b === lowest && b.balance_cents < 0
                          ? "forecast-point forecast-point--low"
                          : "forecast-point"
                      }
                      r={b === lowest && b.balance_cents < 0 ? 6 : 4}
                    >
                      <title>
                        {b.date}: {usd(b.balance_cents)} projected
                      </title>
                    </circle>
                  ))}
                </svg>
              ) : (
                <p>No dated forecast records returned.</p>
              )}
            </ChartWrapper>
          </>
        )}
      </Card>
      {data && !compact && (
        <Commitments
          title="Upcoming cash calendar"
          items={data.events}
          onEvidence={onEvidence}
        />
      )}
    </section>
  );
}
export function CashScreen() {
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  return (
    <div className="page-stack finance-page">
      <PageHeading
        title="Your month, before it happens"
        description="A dated view of projected cash, upcoming commitments and their assumptions."
      />
      <ForecastPanel onEvidence={setEvidence} />
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
