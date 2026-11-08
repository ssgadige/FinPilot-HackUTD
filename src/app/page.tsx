import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  ChartNoAxesCombined,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { DecisionControls } from "@/components/decision-controls";
import { Card, MetricCard } from "@/components/ui/card";
import { ChartWrapper } from "@/components/ui/chart-wrapper";
import { DataTable } from "@/components/ui/data-table";

const commitments = [
  { date: "Nov 10", label: "Planned card payment", amount: "−$1,250.00" },
  { date: "Nov 15", label: "Expected paycheck", amount: "+$2,600.00" },
];

export default function Home() {
  return (
    <div className="page-stack">
      <PageHeading
        title="Your financial command center"
        description="A shared shell for every financial decision."
        action={
          <Link href="/overview" className={buttonClass()}>
            Open overview
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />
      <div className="preview-notice">
        <Badge>Fixture preview</Badge>
        <p>
          Illustrative values for the shared UI. No account data or agent
          results have been loaded.
        </p>
      </div>
      <div className="metrics-grid">
        <MetricCard
          label="Liquid cash"
          value="$5,400"
          detail="Example · checking + savings"
          icon={<Banknote size={19} />}
        />
        <MetricCard
          label="Debt"
          value="$17,600"
          detail="Example · cards and loans"
          icon={<CreditCard size={19} />}
        />
        <MetricCard
          label="Net worth"
          value="$9,200"
          detail="Example · assets minus liabilities"
          icon={<ChartNoAxesCombined size={19} />}
        />
      </div>
      <div className="decision-grid">
        <div className="page-stack">
          <Card>
            <ChartWrapper
              title="Money pulse — next 30 days"
              description="Illustrative forecast · fixture, not a calculated projection"
              dataTable={
                <p className="small muted">
                  The design illustration shows a mid-period dip followed by
                  recovery. No numerical daily balances are supplied by this
                  fixture; no forecast has been calculated.
                </p>
              }
            >
              <div className="reference-chart">
                <Image
                  src="/images/forecast-reference.svg"
                  width={828}
                  height={190}
                  alt="Illustrative line: balance dips mid-period, then recovers toward day 30. No calculated daily values."
                  loading="eager"
                  unoptimized
                />
              </div>
              <div className="chart-axis">
                <span>Today</span>
                <span>15 days</span>
                <span>30 days</span>
              </div>
            </ChartWrapper>
          </Card>
          <Card>
            <div className="card-heading">
              <h2>Upcoming commitments</h2>
              <span className="muted small">Fixture examples</span>
            </div>
            <DataTable
              caption="Illustrative upcoming commitments, not scheduled payments"
              columns={[
                { key: "date", label: "Date", render: (row) => row.date },
                {
                  key: "label",
                  label: "Commitment",
                  render: (row) => row.label,
                },
                {
                  key: "amount",
                  label: "Amount (USD)",
                  numeric: true,
                  render: (row) => row.amount,
                },
              ]}
              rows={commitments}
              rowKey={(row) => row.label}
            />
          </Card>
        </div>
        <div className="page-stack">
          <Card>
            <h2>One clear next move</h2>
            <p className="muted">
              Findings turn account records into a decision you can inspect.
            </p>
          </Card>
          <Card>
            <h2>Explore your workspace</h2>
            <ol className="workspace-steps">
              <li>
                <Link href="/institutions">
                  Connect institutions
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/overview">
                  Review financial picture
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link href="/goals-and-plans">
                  Compare a plan
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </li>
            </ol>
          </Card>
          <DecisionControls />
        </div>
      </div>
    </div>
  );
}
