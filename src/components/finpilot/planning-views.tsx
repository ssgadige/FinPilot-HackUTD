"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  financialDate,
  inputCents,
  money,
  newKey,
  titleCase,
  type Debt as DebtType,
  type Forecast,
  type Goal,
  type Plan,
} from "../../lib/finpilot";
import { useResource, useWorkspace } from "./context";
import {
  BalanceChart,
  Card,
  Empty,
  Icon,
  Loading,
  Modal,
  Notice,
  Stat,
  useAction,
} from "./ui";
export function Debt() {
  const { accounts } = useWorkspace();
  const debts = useResource<{ items: DebtType[] }>("debts");
  if (!accounts.length) return <Empty />;
  return (
    <div className="content-grid">
      <div className="content-column">
        <Card title="Balances and payment context">
          {debts.loading ? (
            <Loading />
          ) : debts.error ? (
            <Notice tone="error">{debts.error}</Notice>
          ) : debts.data!.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="number">Balance owed</th>
                    <th>APR</th>
                    <th className="number">Minimum</th>
                    <th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.data!.items.map((d) => {
                    const account = accounts.find((a) => a.id === d.id);
                    return (
                      <tr key={d.id}>
                        <td>
                          <strong>{titleCase(account?.kind || "debt")}</strong>
                          <span className="small muted">
                            {" "}
                            · {account?.last_four}
                          </span>
                        </td>
                        <td className="number">{money(d.balance_cents)}</td>
                        <td>
                          {d.apr_bps === null
                            ? "Unknown"
                            : `${(d.apr_bps / 100).toFixed(2)}%`}
                        </td>
                        <td className="number">
                          {money(d.minimum_payment_cents)}
                        </td>
                        <td>
                          {d.utilization_bps === null
                            ? "Limit unavailable"
                            : `${(d.utilization_bps / 100).toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No debt accounts linked"
              text="Link a credit card or loan to review balances, rates and minimum payments."
            />
          )}
        </Card>
        <Card title="Explore a payment before making it">
          <p className="muted">
            See monthly payments, total interest and the effect of an extra
            payment. Every calculation includes its rounding assumptions.
          </p>
          <Link className="button" href="/calculators?kind=loan">
            Open payoff calculator
            <Icon name="arrow" size={16} />
          </Link>
        </Card>
      </div>
      <aside className="inspector">
        <Card title="Preserve your bill cash">
          <p>
            A faster payoff should leave enough cash for your scheduled
            commitments. Review both timing and totals.
          </p>
          <Link href="/cash" className="text-button">
            Review cash & bills
            <Icon name="arrow" size={14} />
          </Link>
        </Card>
        <Notice>
          These are descriptive indicators. FinPilot does not predict exact
          credit-score gains or execute payments.
        </Notice>
      </aside>
    </div>
  );
}
export function Goals() {
  const { overview, notify, refresh } = useWorkspace();
  const goals = useResource<{ items: Goal[] }>("goals"),
    plans = useResource<{ items: Plan[] }>("plans");
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined),
    [accepting, setAccepting] = useState<Plan | null>(null);
  const action = useAction();
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void action.run(async () => {
      const input = {
        target_cents: inputCents(data.get("target")),
        deadline: String(data.get("deadline")),
        priority: Number(data.get("priority")),
      };
      if (editing) await api("goals/" + editing.id, "PATCH", input);
      else
        await api("goals", "POST", {
          ...input,
          title: String(data.get("title")),
        });
      setEditing(undefined);
      notify(
        "Goal saved. Dependent planning results will need a fresh checkup.",
      );
      refresh();
    });
  };
  return (
    <>
      <div className="section-toolbar">
        <div className="button-row">
          <span className="subtle-tag">YOUR PRIORITIES</span>
          <Link href="/calculators?kind=savings" className="text-button">
            Savings calculator
            <Icon name="arrow" size={14} />
          </Link>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(null);
            action.clear();
          }}
        >
          <Icon name="plus" size={16} />
          Add a goal
        </button>
      </div>
      {goals.error && <Notice tone="error">{goals.error}</Notice>}
      {goals.loading ? (
        <Loading />
      ) : (
        <div className="goal-grid">
          {goals.data!.items.map((g) => (
            <Card key={g.id}>
              <div className="split">
                <span className="subtle-tag">PRIORITY {g.priority}</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(g);
                    action.clear();
                  }}
                  aria-label={`Edit ${g.title}`}
                >
                  Edit
                  <Icon name="arrow" size={14} />
                </button>
              </div>
              <h2 className="goal-title">{g.title}</h2>
              <div className="goal-value">
                {money(g.saved_cents)} <span>of {money(g.target_cents)}</span>
              </div>
              <progress
                max={g.target_cents}
                value={Math.min(g.saved_cents, g.target_cents)}
                aria-label={`${g.title} saved progress`}
              />
              <div className="split muted small">
                <span>By {financialDate(g.deadline)}</span>
                <span>Version {g.version}</span>
              </div>
            </Card>
          ))}
          {!goals.data!.items.length && (
            <Empty
              title="Give your next goal a place"
              text="Create a target and deadline, then review a contribution you can sustain."
              link={false}
            />
          )}
        </div>
      )}
      <Card
        title="Your financial plans"
        action={
          <Link href="/agents" className="text-button">
            Request a checkup
            <Icon name="arrow" size={14} />
          </Link>
        }
      >
        {plans.loading ? (
          <Loading />
        ) : plans.error ? (
          <Notice tone="error">{plans.error}</Notice>
        ) : !plans.data!.items.length ? (
          <div className="inline-empty">
            <Icon name="target" size={28} />
            <h3>No plan proposals yet</h3>
            <p>
              A completed, evidence-backed planning run can produce a proposal
              for your review. Your goals remain saved while the agent runtime
              is unavailable.
            </p>
          </div>
        ) : (
          plans.data!.items.map((p) => (
            <div className="plan-row" key={p.id}>
              <div>
                <strong>Financial plan · version {p.version}</strong>
                <span className="small muted">
                  Snapshot {p.snapshot_version} ·{" "}
                  {p.stale ? "Needs a fresh checkup" : titleCase(p.status)}
                </span>
              </div>
              <span
                className={`status-pill ${p.stale ? "warning" : p.status === "accepted" ? "success" : ""}`}
              >
                {p.stale ? "Stale" : titleCase(p.status)}
              </span>
              <button
                className="button secondary compact"
                onClick={() => {
                  setAccepting(p);
                  action.clear();
                }}
                disabled={p.stale || p.status !== "proposed"}
              >
                Review proposal
              </button>
            </div>
          ))
        )}
      </Card>
      {editing !== undefined && (
        <Modal
          title={editing ? "Edit your goal" : "Set a goal that fits your life"}
          onClose={() => setEditing(undefined)}
          busy={action.busy}
        >
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <form className="form-stack" onSubmit={save}>
            <label>
              Goal name
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={editing?.title || ""}
                readOnly={!!editing}
                placeholder="e.g. Car fund"
              />
            </label>
            <div className="form-grid">
              <label>
                Target amount (USD)
                <input
                  name="target"
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  defaultValue={
                    editing ? editing.target_cents / 100 : undefined
                  }
                  placeholder="8000.00"
                />
              </label>
              <label>
                Deadline
                <input
                  name="deadline"
                  type="date"
                  min={overview.as_of}
                  required
                  defaultValue={editing?.deadline || ""}
                />
              </label>
            </div>
            <label>
              Priority
              <select name="priority" defaultValue={editing?.priority || 1}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n === 1 ? " — highest" : n === 5 ? " — lowest" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Notice>
              Current saved amount: {money(editing?.saved_cents || 0)}. Use the
              savings calculator to test contributions. Saving a goal does not
              allocate or transfer money.
            </Notice>
            <label className="checkbox-label">
              <input type="checkbox" required />I confirm this target, deadline
              and priority.
            </label>
            <button className="button" disabled={action.busy}>
              {action.busy ? "Saving…" : "Save goal"}
            </button>
          </form>
        </Modal>
      )}
      {accepting && (
        <Modal
          title="Review before accepting"
          onClose={() => setAccepting(null)}
          busy={action.busy}
        >
          {action.error && (
            <Notice tone="error">
              {action.error} Refresh the workspace if a newer version exists.
            </Notice>
          )}
          <div className="detail-list">
            <span>
              Plan version<strong>{accepting.version}</strong>
            </span>
            <span>
              Financial snapshot<strong>{accepting.snapshot_version}</strong>
            </span>
          </div>
          <PlanDetails payload={accepting.payload} />
          <Notice>
            Accepting saves this financial plan. It does not make a payment or
            transfer.
          </Notice>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api(`plans/${accepting.id}/accept`, "POST", {
                  expected_version: accepting.version,
                  confirmation: true,
                  idempotency_key: action.key({
                    plan: accepting.id,
                    version: accepting.version,
                  }),
                });
                setAccepting(null);
                notify(
                  "Plan accepted. No financial transactions were executed.",
                );
                refresh();
              });
            }}
          >
            <label className="checkbox-label">
              <input type="checkbox" required />I reviewed this allocation, its
              assumptions and its version.
            </label>
            <div className="button-row">
              <button className="button" disabled={action.busy}>
                Accept selected plan
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={action.busy}
                onClick={refresh}
              >
                Refresh plans
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function PlanDetails({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object")
    return <p className="muted">No allocation details were supplied.</p>;
  return (
    <div className="plan-details">
      <PlanValue value={payload} />
    </div>
  );
}
function PlanValue({
  value,
  name = "",
  depth = 0,
}: {
  value: unknown;
  name?: string;
  depth?: number;
}) {
  if (value == null) return <span className="muted">Not supplied</span>;
  if (typeof value === "number")
    return (
      <strong>{name.endsWith("cents") ? money(value) : String(value)}</strong>
    );
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "string") return <span>{value}</span>;
  if (depth > 6)
    return (
      <span className="muted">
        Review the supporting agent evidence for additional detail.
      </span>
    );
  if (Array.isArray(value))
    return (
      <ul>
        {value.map((entry, i) => (
          <li key={i}>
            <PlanValue value={entry} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  return (
    <dl>
      {Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
        <div key={key}>
          <dt>{titleCase(key)}</dt>
          <dd>
            <PlanValue value={entry} name={key} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

type Calculation = {
  payment_cents?: number;
  interest_cents?: number;
  total_paid_cents?: number;
  payoff_months?: number;
  remaining_cents?: number;
  contribution_cents?: number;
  projected_cents?: number;
  funded?: boolean;
  assumptions: string[];
  evidence_ids: string[];
  schedule?: {
    month: number;
    payment_cents: number;
    interest_cents: number;
    principal_cents: number;
    balance_cents: number;
  }[];
};
export function Calculators() {
  const params = useSearchParams();
  const [kind, setKind] = useState(
      params.get("kind") === "savings" ? "savings" : "loan",
    ),
    [result, setResult] = useState<Calculation | null>(null);
  const { evidence } = useWorkspace();
  const action = useAction();
  const calculate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void action.run(async () => {
      const input =
        kind === "loan"
          ? {
              kind,
              principal_cents: inputCents(data.get("principal")),
              apr_bps: inputCents(data.get("rate")),
              months: Number(data.get("months")),
              extra_payment_cents: inputCents(data.get("extra")),
            }
          : {
              kind,
              target_cents: inputCents(data.get("target")),
              saved_cents: inputCents(data.get("saved")),
              months: Number(data.get("months")),
              apy_bps: inputCents(data.get("rate")),
            };
      setResult(await api<Calculation>("calculations", "POST", input));
    });
  };
  return (
    <>
      <div className="section-toolbar">
        <div className="segmented">
          {[
            ["loan", "Payoff calculator"],
            ["savings", "Savings contribution"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={kind === id ? "selected" : ""}
              aria-pressed={kind === id}
              onClick={() => {
                setKind(id);
                setResult(null);
                action.clear();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="subtle-tag">HYPOTHETICAL CALCULATION</span>
      </div>
      {result && (
        <div className="stats-grid">
          {kind === "loan" ? (
            <>
              <Stat
                label="Required monthly payment"
                value={money(result.payment_cents)}
                note="Before extra payment"
              />
              <Stat
                label="Total interest"
                value={money(result.interest_cents)}
                note={`${result.payoff_months} payments`}
              />
              <Stat
                label="Total paid"
                value={money(result.total_paid_cents)}
                note="Final payment adjusted"
              />
            </>
          ) : (
            <>
              <Stat
                label="Monthly contribution"
                value={money(result.contribution_cents)}
                note="Rounded up to the next cent"
              />
              <Stat
                label="Projected ending savings"
                value={money(result.projected_cents)}
                note="Constant yield assumption"
              />
              <Stat
                label="Goal status"
                value={result.funded ? "Funded" : "Contribution needed"}
                note="No money allocated automatically"
              />
            </>
          )}
        </div>
      )}
      <div className="content-grid">
        <div className="content-column">
          <Card title={kind === "loan" ? "Loan inputs" : "Savings goal inputs"}>
            {action.error && <Notice tone="error">{action.error}</Notice>}
            <form className="form-stack" key={kind} onSubmit={calculate}>
              {kind === "loan" ? (
                <>
                  <label>
                    Principal (USD)
                    <input
                      type="number"
                      name="principal"
                      placeholder="10000.00"
                      min="0.01"
                      max="1000000"
                      step="0.01"
                      required
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Nominal annual rate (%)
                      <input
                        type="number"
                        name="rate"
                        placeholder="6.00"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      Term (months)
                      <input
                        type="number"
                        name="months"
                        placeholder="36"
                        min="1"
                        max="600"
                        step="1"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Extra monthly payment (USD)
                    <input
                      type="number"
                      name="extra"
                      defaultValue="0"
                      min="0"
                      max="1000000"
                      step="0.01"
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="form-grid">
                    <label>
                      Target amount (USD)
                      <input
                        type="number"
                        name="target"
                        placeholder="8000.00"
                        min="0.01"
                        max="1000000"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      Current savings (USD)
                      <input
                        type="number"
                        name="saved"
                        placeholder="2400.00"
                        min="0"
                        max="1000000"
                        step="0.01"
                        required
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      Months remaining
                      <input
                        type="number"
                        name="months"
                        placeholder="12"
                        min="1"
                        max="600"
                        step="1"
                        required
                      />
                    </label>
                    <label>
                      Annual yield / APY (%)
                      <input
                        type="number"
                        name="rate"
                        defaultValue="0"
                        min="0"
                        max="30"
                        step="0.01"
                        required
                      />
                    </label>
                  </div>
                </>
              )}
              <label>
                Payment / contribution timing
                <input value="End of each month" readOnly />
              </label>
              <button className="button" disabled={action.busy}>
                {action.busy
                  ? "Calculating…"
                  : kind === "loan"
                    ? "Calculate payoff"
                    : "Calculate contribution"}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          </Card>
          {result?.schedule && (
            <Card title="Your payoff result, line by line">
              <div className="table-wrap schedule">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th className="number">Payment</th>
                      <th className="number">Interest</th>
                      <th className="number">Principal</th>
                      <th className="number">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.schedule.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td className="number">{money(row.payment_cents)}</td>
                        <td className="number">{money(row.interest_cents)}</td>
                        <td className="number">{money(row.principal_cents)}</td>
                        <td className="number">{money(row.balance_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <aside className="inspector">
          <Card title="A result you can verify">
            <p>
              Inputs are sent to deterministic server calculations. Financial
              amounts come back in integer cents.
            </p>
            <p>
              {kind === "loan"
                ? "The final payment clears any rounding residual. Rates are nominal, fixed and exclude fees."
                : "APY is converted to a monthly effective rate. Already-funded goals need no additional contribution."}
            </p>
          </Card>
          {result && (
            <Card title="Calculation assumptions">
              <ul className="assumption-list">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <button
                className="text-button"
                onClick={() => evidence(result.evidence_ids[0])}
              >
                View calculation evidence
                <Icon name="arrow" size={14} />
              </button>
            </Card>
          )}
          <Notice>
            Hypothetical results do not guarantee returns, approval or
            affordability.
          </Notice>
        </aside>
      </div>
    </>
  );
}
export function Scenarios() {
  const { accounts, overview, refresh, notify, evidence } = useWorkspace();
  const router = useRouter();
  const baseline = useResource<Forecast>("forecast?days=90");
  const [eventKind, setEventKind] = useState("surprise_expense");
  const [kind, setKind] = useState("surprise_expense"),
    [result, setResult] = useState<Forecast | null>(null),
    [event, setEvent] = useState<{
      run_id: string;
      snapshot_version: number;
    } | null>(null);
  const action = useAction();
  if (!accounts.length) return <Empty />;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void action.run(async () => {
      const input =
        kind === "surprise_expense"
          ? { kind, expense_cents: inputCents(data.get("amount")) }
          : kind === "delayed_income"
            ? { kind, delay_days: Number(data.get("days")) }
            : { kind, income_drop_pct: Number(data.get("drop")) };
      setResult(await api<Forecast>("scenarios", "POST", input));
    });
  };
  return (
    <>
      {action.error && <Notice tone="error">{action.error}</Notice>}
      <div className="stats-grid">
        <Stat
          label="Baseline minimum"
          value={baseline.data ? money(baseline.data.low_cash_cents) : "—"}
          note="Next 90 days"
        />
        <Stat
          label="Scenario minimum"
          value={result ? money(result.low_cash_cents) : "—"}
          note={
            result
              ? financialDate(result.low_cash_date)
              : "Run a scenario to compare"
          }
        />
        <Stat
          label="Current snapshot"
          value={`v${overview.snapshot_version}`}
          note="Your accepted plan is preserved"
        />
      </div>
      <div className="content-grid">
        <div className="content-column">
          <Card title="Stress controls">
            <form className="form-stack" onSubmit={submit}>
              <label>
                Scenario
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setResult(null);
                  }}
                >
                  <option value="surprise_expense">Unexpected expense</option>
                  <option value="delayed_income">Delayed income</option>
                  <option value="income_drop">Income drop</option>
                </select>
              </label>
              {kind === "surprise_expense" ? (
                <label>
                  Expense amount (USD)
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    placeholder="900.00"
                    required
                  />
                </label>
              ) : kind === "delayed_income" ? (
                <label>
                  Delay (days)
                  <input
                    name="days"
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    placeholder="7"
                    required
                  />
                </label>
              ) : (
                <label>
                  Income drop (%)
                  <input
                    name="drop"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    placeholder="20"
                    required
                  />
                </label>
              )}
              <label>
                Scope / horizon
                <input value="Linked account schedules / 90 days" readOnly />
              </label>
              <button className="button" disabled={action.busy}>
                {action.busy ? "Calculating…" : "Calculate scenario"}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          </Card>
          {baseline.data && (
            <Card title="Baseline and stressed balance">
              <BalanceChart
                points={baseline.data.dated_balances}
                comparison={result?.dated_balances}
                onEvidence={
                  result ? () => evidence(result.evidence_ids[0]) : undefined
                }
              />
              {result && (
                <Notice tone={result.low_cash_cents < 0 ? "warning" : "info"}>
                  {result.low_cash_cents < 0
                    ? "The scenario includes a negative projected balance."
                    : "Review the projected cushion before making a decision."}{" "}
                  Lowest point: {money(result.low_cash_cents)} on{" "}
                  {financialDate(result.low_cash_date)}.
                </Notice>
              )}
            </Card>
          )}
          <Card title="Apply a demo change and request plan repair">
            <Notice tone="warning">
              This changes your simulated workspace. An expense updates the
              fixture ledger once; an income delay updates the forecast. The
              current plan will not be replaced automatically.
            </Notice>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void action.run(async () => {
                  const eventKind = String(data.get("event_kind"));
                  const input =
                    eventKind === "surprise_expense"
                      ? {
                          kind: eventKind,
                          amount_cents: inputCents(data.get("event_value")),
                          idempotency_key: action.key({
                            eventKind,
                            value: String(data.get("event_value")),
                          }),
                        }
                      : {
                          kind: eventKind,
                          days: Number(data.get("event_value")),
                          idempotency_key: action.key({
                            eventKind,
                            value: String(data.get("event_value")),
                          }),
                        };
                  const applied = await api<{
                    run_id: string;
                    snapshot_version: number;
                  }>("demo/events", "POST", input);
                  setEvent(applied);
                  notify(
                    `Demo event applied once. Snapshot ${applied.snapshot_version}; repair requested.`,
                  );
                  refresh();
                  router.push(
                    "/agents?run=" + encodeURIComponent(applied.run_id),
                  );
                });
              }}
            >
              <label>
                Demo event
                <select
                  name="event_kind"
                  value={eventKind}
                  onChange={(e) => setEventKind(e.target.value)}
                >
                  <option value="surprise_expense">
                    Surprise expense (USD)
                  </option>
                  <option value="delayed_income">
                    Delayed income (whole days, 1–60)
                  </option>
                </select>
              </label>
              <label>
                Event value
                <input
                  name="event_value"
                  type="number"
                  min={eventKind === "delayed_income" ? 1 : 0.01}
                  max={eventKind === "delayed_income" ? 60 : 1000000}
                  step={eventKind === "delayed_income" ? 1 : 0.01}
                  required
                  placeholder="900.00"
                />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" required />
                Apply this change to my simulated records and request a repair.
              </label>
              <button className="button secondary" disabled={action.busy}>
                Apply demo event
              </button>
            </form>
            {event && (
              <Notice tone="success">
                Event saved in snapshot {event.snapshot_version}.{" "}
                <Link href={"/agents?run=" + event.run_id}>
                  Inspect the repair run
                </Link>
                .{" "}
                <button className="text-button" onClick={refresh}>
                  Refresh financial picture
                </button>
              </Notice>
            )}
          </Card>
        </div>
        <aside className="inspector">
          <Card title="No probability claim">
            <p>This is one explicit scenario, not a prediction of risk.</p>
          </Card>
          <Card title="The scope is visible">
            <p>
              Scenarios use known account schedules. Plan-specific allocations
              are not yet supported. Expenses are applied at the start of the
              forecast.
            </p>
          </Card>
          {result && (
            <Card title="Assumptions">
              <ul className="assumption-list">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
