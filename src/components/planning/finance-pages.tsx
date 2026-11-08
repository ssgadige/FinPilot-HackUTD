"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, SelectField } from "@/components/ui/form-field";
import { DataTable } from "@/components/ui/data-table";
import { ChartWrapper } from "@/components/ui/chart-wrapper";
import {
  EvidenceDrawer,
  type EvidenceRecord,
} from "@/components/finance/evidence-drawer";
import { useFinanceScope } from "@/components/finance/finance-scope";
import { usd } from "@/lib/finance-api";
import {
  workspaceApi,
  WorkspaceProblem,
  inputCents,
  rate,
  type Calculation,
  type Debt,
} from "@/lib/workspace-api";
import {
  useWorkspaceRead,
  useWorkspaceAction,
  ResourceState,
} from "./workspace-state";
import { Sources, Unlinked, SafetyNote, EvidenceLinks } from "./shared";

export function DebtsScreen() {
  const { accounts } = useFinanceScope();
  const r = useWorkspaceRead("debts", async (signal) => {
    const rows = await workspaceApi.debts(signal);
    if (rows.some((d) => !accounts.items.some((a) => a.id === d.id)))
      throw new WorkspaceProblem(403, "revoked");
    return rows;
  });
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  return (
    <div className="page-stack planning-page">
      <PageHeading
        title="Give every payment a purpose"
        description="Inspect linked liabilities and compare hypothetical payments without promising approval or a credit-score change."
      />
      <Sources />
      {!accounts.items.length ? (
        <Unlinked />
      ) : r.data ? (
        <Card>
          <h2>Debt inventory</h2>
          <DataTable
            caption="Linked debt inventory"
            rows={r.data.filter((d) =>
              accounts.items.some((a) => a.id === d.id),
            )}
            rowKey={(d) => d.id}
            emptyMessage="No linked debts were returned."
            columns={[
              {
                key: "account",
                label: "Account",
                render: (d) =>
                  accounts.items.find((a) => a.id === d.id)?.label ??
                  "Unavailable",
              },
              {
                key: "balance",
                label: "Balance owed",
                numeric: true,
                render: (d) => usd(d.balance_cents),
              },
              { key: "apr", label: "APR", render: (d) => rate(d.apr_bps) },
              {
                key: "min",
                label: "Monthly minimum",
                numeric: true,
                render: (d) => usd(d.minimum_payment_cents),
              },
              {
                key: "limit",
                label: "Credit limit / utilization",
                render: (d) => (
                  <>
                    {usd(d.credit_limit_cents)} / {rate(d.utilization_bps)}
                  </>
                ),
              },
              {
                key: "evidence",
                label: "Source",
                render: (d) => (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const a = accounts.items.find((a) => a.id === d.id);
                      if (a) setEvidence({ account: a });
                    }}
                  >
                    Inspect account
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <ResourceState {...r} />
      )}
      <LoanComparison debts={r.data ?? []} />
      <SafetyNote />
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
function LoanComparison({ debts }: { debts: Debt[] }) {
  const { accounts } = useFinanceScope();
  const action = useWorkspaceAction();
  const [principal, setPrincipal] = useState(""),
    [apr, setApr] = useState(""),
    [months, setMonths] = useState("36"),
    [extra, setExtra] = useState("0"),
    [error, setError] = useState(""),
    [result, setResult] = useState<Calculation[] | null>(null);
  return (
    <Card>
      <h2>Payment comparison · hypothetical</h2>
      <p>
        Both alternatives use the server calculator. Existing bills,
        account-specific cash buffers, fees and future rate changes are not
        evaluated here.
      </p>
      <form
        className="planning-form"
        onSubmit={(e) => {
          e.preventDefault();
          const p = inputCents(principal),
            a = inputCents(apr),
            x = inputCents(extra),
            m = Number(months);
          if (
            p === null ||
            p <= 0 ||
            a === null ||
            a > 10000 ||
            x === null ||
            !Number.isInteger(m) ||
            m < 1 ||
            m > 600
          ) {
            setError(
              "Enter a positive principal, APR from 0–100%, whole months from 1–600 and a nonnegative extra payment.",
            );
            return;
          }
          setError("");
          setResult(null);
          void action.run(
            (s, csrf) =>
              Promise.all(
                [0, x].map((extra_payment_cents) =>
                  workspaceApi.calculation(
                    "calculations",
                    {
                      kind: "loan",
                      principal_cents: p,
                      apr_bps: a,
                      months: m,
                      extra_payment_cents,
                    },
                    csrf,
                    s,
                  ),
                ),
              ),
            setResult,
          );
        }}
      >
        <SelectField
          label="Use a linked debt as input"
          defaultValue=""
          onChange={(e) => {
            const d = debts.find((d) => d.id === e.target.value);
            if (d) {
              setPrincipal((d.balance_cents / 100).toFixed(2));
              setApr(
                typeof d.apr_bps === "number"
                  ? (d.apr_bps / 100).toFixed(2)
                  : "",
              );
              setResult(null);
            }
          }}
        >
          <option value="">Enter hypothetical values</option>
          {debts.map((d) => (
            <option key={d.id} value={d.id}>
              {accounts.items.find((a) => a.id === d.id)?.label ?? d.id}
            </option>
          ))}
        </SelectField>
        <div className="finance-filters">
          <FormField
            label="Principal (USD)"
            inputMode="decimal"
            required
            value={principal}
            onChange={(e) => {
              setPrincipal(e.target.value);
              setResult(null);
            }}
          />
          <FormField
            label="APR (%)"
            inputMode="decimal"
            required
            value={apr}
            onChange={(e) => {
              setApr(e.target.value);
              setResult(null);
            }}
          />
          <FormField
            label="Payment period (months)"
            type="number"
            min={1}
            max={600}
            required
            value={months}
            onChange={(e) => {
              setMonths(e.target.value);
              setResult(null);
            }}
          />
          <FormField
            label="Extra monthly payment (USD)"
            inputMode="decimal"
            required
            value={extra}
            onChange={(e) => {
              setExtra(e.target.value);
              setResult(null);
            }}
          />
        </div>
        <Button type="submit" disabled={action.busy}>
          {action.busy ? "Calculating…" : "Compare server calculations"}
        </Button>
        {(error || action.error) && <p role="alert">{error || action.error}</p>}
      </form>
      {result && (
        <div className="planning-grid">
          {result.map((r, i) => (
            <Card key={i}>
              <h3>{i ? "With extra payment" : "Baseline payment"}</h3>
              <p>Base monthly payment: {usd(r.payment_cents)}</p>
              <p>
                Interest: {usd(r.interest_cents)} · Total paid:{" "}
                {usd(r.total_paid_cents)}
              </p>
              <p>
                Payoff period: {r.payoff_months ?? "Unavailable"} months ·
                Remaining: {usd(r.remaining_cents)}
              </p>
              <p>
                Financial source: {r.source_mode ?? "Unavailable"} ·
                Hypothetical calculation, not a payment instruction.
              </p>
              <p>{r.assumptions.join("; ")}</p>
              <EvidenceLinks ids={r.evidence_ids ?? []} />
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}
export function AssetsScreen() {
  const { accounts } = useFinanceScope();
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  return (
    <div className="page-stack planning-page">
      <PageHeading
        title="Assets, with their limitations"
        description="Review savings and restricted assets without treating retirement or investment holdings as bill-paying cash."
        action={<Link href="/scenario-lab">Review cash scenarios</Link>}
      />
      <Sources />
      {!accounts.items.length ? (
        <Unlinked />
      ) : (
        <>
          <Card>
            <h2>Savings and liquid accounts</h2>
            <AssetRows kinds={["checking", "savings"]} inspect={setEvidence} />
          </Card>
          <Card>
            <h2>CD, IRA and brokerage snapshots</h2>
            <p>
              These balances are displayed separately from spendable cash.
              Market values, access restrictions, penalties and tax effects may
              differ.
            </p>
            <AssetRows
              kinds={["cd", "ira", "brokerage"]}
              inspect={setEvidence}
            />
          </Card>
        </>
      )}
      <Card>
        <h2>Valuation and maturity</h2>
        <p>
          The accounts response supplies balance snapshots and observation
          dates. Individual valuation timestamps remain unavailable. CD maturity
          is displayed only when supplied by the authorized account response. No
          maturity date, yield or guaranteed future value is inferred.
        </p>
      </Card>
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
function AssetRows({
  kinds,
  inspect,
}: {
  kinds: string[];
  inspect: (r: EvidenceRecord) => void;
}) {
  const { accounts } = useFinanceScope();
  return (
    <DataTable
      caption={
        kinds.includes("cd")
          ? "Restricted asset snapshots"
          : "Liquid account snapshots"
      }
      rows={accounts.items.filter((a) => kinds.includes(a.kind))}
      rowKey={(a) => a.id}
      columns={[
        { key: "label", label: "Account", render: (a) => a.label },
        { key: "kind", label: "Kind", render: (a) => a.kind },
        {
          key: "balance",
          label: "Reported balance",
          numeric: true,
          render: (a) => usd(a.balance_cents),
        },
        {
          key: "valuation",
          label: "Observation / CD maturity",
          render: (a) =>
            `${accounts.as_of ?? "Unknown"} / ${a.kind === "cd" ? (a.maturity_date ?? "Maturity unavailable") : "Not a CD"}`,
        },
        {
          key: "evidence",
          label: "Source",
          render: (a) => (
            <Button variant="ghost" onClick={() => inspect({ account: a })}>
              Inspect account
            </Button>
          ),
        },
      ]}
    />
  );
}
export function ScenariosScreen() {
  const { accounts } = useFinanceScope();
  const plans = useWorkspaceRead("scenario-plans", workspaceApi.plans);
  const action = useWorkspaceAction();
  const [kind, setKind] = useState("surprise_expense"),
    [value, setValue] = useState(""),
    [plan, setPlan] = useState(""),
    [result, setResult] = useState<Calculation | null>(null),
    [error, setError] = useState("");
  return (
    <div className="page-stack planning-page">
      <PageHeading
        title="Rehearse the unexpected"
        description="Stress a current financial snapshot or an existing plan using deterministic server calculations."
      />
      <Sources />
      {!accounts.items.length && <Unlinked />}
      <div className="planning-grid">
        <Card>
          <h2>Scenario assumptions</h2>
          <form
            className="planning-form"
            onSubmit={(e) => {
              e.preventDefault();
              const amount =
                kind === "surprise_expense" ? inputCents(value) : Number(value);
              if (
                amount === null ||
                !Number.isInteger(amount) ||
                amount <= 0 ||
                (kind === "delayed_income" && amount > 60) ||
                (kind === "income_drop" && amount > 100)
              ) {
                setError(
                  "Enter a positive expense, 1–60 whole delay days, or 1–100 whole percent income reduction.",
                );
                return;
              }
              setError("");
              setResult(null);
              void action.run(
                (s, csrf) =>
                  workspaceApi.calculation(
                    "scenarios",
                    {
                      kind,
                      ...(kind === "surprise_expense"
                        ? { expense_cents: amount }
                        : kind === "delayed_income"
                          ? { delay_days: amount }
                          : { income_drop_pct: amount }),
                      ...(plan ? { plan_id: plan } : {}),
                    },
                    csrf,
                    s,
                  ),
                setResult,
              );
            }}
          >
            <SelectField
              label="Scenario"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setValue("");
                setResult(null);
              }}
            >
              <option value="surprise_expense">Surprise expense</option>
              <option value="delayed_income">Delayed income</option>
              <option value="income_drop">Income reduction</option>
            </SelectField>
            <FormField
              label={
                kind === "surprise_expense"
                  ? "Expense (USD)"
                  : kind === "delayed_income"
                    ? "Delay (days)"
                    : "Income reduction (%)"
              }
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setResult(null);
              }}
              inputMode="decimal"
              required
            />
            <SelectField
              label="Existing plan to stress"
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Current cash schedule only</option>
              {plans.data
                ?.filter(
                  (p) =>
                    !p.stale &&
                    p.snapshot_version === accounts.snapshot_version &&
                    ["accepted", "proposed"].includes(p.status),
                )
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    Version {p.version} · {p.status}
                  </option>
                ))}
            </SelectField>
            {!!plans.error && <ResourceState {...plans} />}
            <Button
              type="submit"
              disabled={!accounts.items.length || action.busy}
            >
              {action.busy ? "Running scenario…" : "Run server scenario"}
            </Button>
            {!accounts.items.length && (
              <p>
                Link and verify an account first. No cash projection is
                manufactured for an empty scope.
              </p>
            )}
            {(error || action.error) && (
              <p role="alert">{error || action.error}</p>
            )}
          </form>
        </Card>
        <Card>
          <h2>Baseline, proposed and stressed outcomes</h2>
          {result ? (
            <ScenarioResult result={result} />
          ) : (
            <p>
              Run a scenario to inspect returned dated balances, reserve
              constraints and assumptions. Baseline comparison and changed goal
              deadlines remain unavailable unless supplied by the backend.
            </p>
          )}
        </Card>
      </div>
      <SafetyNote />
    </div>
  );
}
function ScenarioResult({ result: r }: { result: Calculation }) {
  return (
    <div className="page-stack">
      <p className="planning-value">
        Lowest projected cash: {usd(r.low_cash_cents)}
      </p>
      <p>
        Date: {r.low_cash_date ?? "Unavailable"} · Reserve:{" "}
        {usd(r.reserve_cents)}
      </p>
      <p>
        {r.reserve_breached === true
          ? "Reserve breached"
          : r.reserve_breached === false
            ? "Reserve not breached under these assumptions"
            : "Reserve assessment unavailable"}
      </p>
      <p>
        Source: {r.source_mode ?? "Unavailable"} · Snapshot:{" "}
        {r.snapshot_version ?? "Unavailable"}
      </p>
      <p>{r.assumptions.join("; ")}</p>
      <ChartWrapper
        title="Dated stressed cash"
        description="Projected values returned by the server, not posted transactions."
        dataTable={
          <DataTable
            caption="Dated stressed cash values"
            rows={r.dated_balances ?? []}
            rowKey={(v) => v.date}
            columns={[
              { key: "date", label: "Projected date", render: (v) => v.date },
              {
                key: "cash",
                label: "Projected balance",
                numeric: true,
                render: (v) => usd(v.balance_cents),
              },
            ]}
          />
        }
      >
        <p>
          Use “View chart data” for a readable dated forecast. Baseline and
          revised goal timing were not returned and are not inferred.
        </p>
      </ChartWrapper>
      <EvidenceLinks ids={r.evidence_ids ?? []} />
    </div>
  );
}
