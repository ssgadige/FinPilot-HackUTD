"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  financialDate,
  money,
  titleCase,
  type Forecast,
  type Transaction,
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
} from "./ui";
const liabilities = ["credit_card", "auto_loan", "mortgage"];
export function Summary() {
  const { overview, accounts } = useWorkspace();
  return (
    <div className="stats-grid">
      <Stat
        label="Liquid cash"
        value={accounts.length ? money(overview.liquid_cash_cents) : "—"}
        note="Linked checking + savings"
        icon="wallet"
      />
      <Stat
        label="Debt"
        value={accounts.length ? money(overview.debt_cents) : "—"}
        note="Linked cards and loans"
        icon="trend"
      />
      <Stat
        label="Net worth"
        value={accounts.length ? money(overview.net_worth_cents) : "—"}
        note="Assets minus liabilities"
        icon="target"
      />
    </div>
  );
}
export function OverviewScreen() {
  const { accounts, overview, evidence } = useWorkspace();
  const forecast = useResource<Forecast>("forecast?days=30");
  if (!accounts.length) return <Empty />;
  const labels: Record<string, string> = {
    cash_buffer_months: "Cash buffer",
    savings_rate_bps: "Savings rate",
    debt_payment_income_ratio_bps: "Debt / income",
    card_utilization_bps: "Card utilization",
  };
  return (
    <>
      <Summary />
      <div className="content-grid">
        <div className="content-column">
          <Card
            title="Money pulse"
            action={<span className="subtle-tag">NEXT 30 DAYS</span>}
          >
            {forecast.data ? (
              <BalanceChart
                points={forecast.data.dated_balances}
                onEvidence={() => evidence(forecast.data!.evidence_ids[0])}
              />
            ) : forecast.error ? (
              <Notice tone="error">{forecast.error}</Notice>
            ) : (
              <Loading />
            )}
            <p className="small muted chart-caption">
              Projected balances across linked liquid accounts, using known
              scheduled items.
            </p>
          </Card>
          <Card title="Your financial signals">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th>Current value</th>
                    <th>What it means</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.indicators.map((i) => (
                    <tr key={i.key}>
                      <td className="semibold">
                        {labels[i.key] || titleCase(i.key)}
                      </td>
                      <td>
                        <span className="signal-value">
                          {i.value === null
                            ? "Not available"
                            : i.key === "cash_buffer_months"
                              ? `${i.value.toFixed(1)} months`
                              : `${(i.value / 100).toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="muted small">{i.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Bills />
        </div>
        <aside className="inspector">
          <Card title="A little perspective">
            <div className="inspector-icon">
              <Icon name="calendar" />
            </div>
            <p>
              Enough money overall can still mean insufficient checking cash on
              a bill date.
            </p>
            <Link href="/cash" className="text-button">
              Explore cash & bills <Icon name="arrow" size={15} />
            </Link>
          </Card>
          <Card title="Your next moves">
            <ol className="numbered-list">
              <li>
                <Link href="/cash">Inspect your upcoming commitments</Link>
              </li>
              <li>
                <Link href="/debt">Explore a payment allocation</Link>
              </li>
              <li>
                <Link href="/scenarios">Rehearse the unexpected</Link>
              </li>
            </ol>
          </Card>
          <Card title="Evidence before action">
            <p>
              Inspect a source, compare an alternative, then confirm your
              choice.
            </p>
            <Link href="/chat" className="button secondary full">
              <Icon name="chat" size={16} />
              Ask FinPilot
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
function Bills() {
  const { overview } = useWorkspace();
  return (
    <Card
      title="Upcoming commitments"
      action={
        <Link href="/cash" className="text-button">
          View calendar <Icon name="arrow" size={14} />
        </Link>
      }
    >
      {overview.upcoming_bills.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Commitment</th>
                <th className="number">Amount</th>
              </tr>
            </thead>
            <tbody>
              {overview.upcoming_bills.map((b) => (
                <tr key={b.id}>
                  <td className="muted">Monthly · day {b.day_of_month}</td>
                  <td>{b.label}</td>
                  <td className="number">{money(b.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          No scheduled bills are available for your linked accounts.
        </p>
      )}
    </Card>
  );
}
export function Accounts() {
  const { accounts, institutions } = useWorkspace();
  if (!accounts.length) return <Empty />;
  return (
    <>
      <Summary />
      <div className="content-grid">
        <Card title="Linked accounts">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution / account</th>
                  <th>Type</th>
                  <th className="number">Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="account-cell">
                        <span className="account-glyph">
                          <Icon
                            name={
                              liabilities.includes(a.kind) ? "wallet" : "bank"
                            }
                          />
                        </span>
                        <div>
                          <strong>
                            {institutions.find((i) => i.id === a.institution_id)
                              ?.name || a.institution_id}
                          </strong>
                          <span>
                            {titleCase(a.kind)} · •••• {a.last_four}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`subtle-tag ${liabilities.includes(a.kind) ? "warm" : ""}`}
                      >
                        {liabilities.includes(a.kind)
                          ? "LIABILITY"
                          : ["checking", "savings"].includes(a.kind)
                            ? "LIQUID"
                            : "RESTRICTED"}
                      </span>
                    </td>
                    <td className="number semibold">
                      {money(a.balance_cents)}
                      {liabilities.includes(a.kind) && (
                        <small className="muted"> owed</small>
                      )}
                    </td>
                    <td>
                      <Link
                        className="text-button"
                        aria-label={`View ${titleCase(a.kind)} ${a.last_four} history`}
                        href={
                          "/transactions?account_id=" + encodeURIComponent(a.id)
                        }
                      >
                        History <Icon name="arrow" size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <aside className="inspector">
          <Card title="Available cash policy">
            <p>
              Brokerage, retirement and CD balances are excluded from spendable
              cash. Each account has a different purpose.
            </p>
          </Card>
          <Card title="Your account access">
            <p>
              Only your selected accounts are visible. Account identifiers show
              the last four digits.
            </p>
            <Link href="/settings" className="text-button">
              Manage connection access <Icon name="arrow" size={15} />
            </Link>
          </Card>
        </aside>
      </div>
    </>
  );
}
export function Transactions() {
  const { accounts } = useWorkspace(),
    params = useSearchParams();
  const [filters, setFilters] = useState({
      account_id: params.get("account_id") || "",
      from: "",
      to: "",
      category: "",
      q: "",
    }),
    [cursor, setCursor] = useState(""),
    [selected, setSelected] = useState<Transaction | null>(null);
  const query = new URLSearchParams(
    Object.entries({ ...filters, cursor, limit: "50" }).filter(([, v]) => v),
  );
  const result = useResource<{
    items: Transaction[];
    next_cursor: string | null;
  }>("transactions?" + query.toString());
  if (!accounts.length) return <Empty />;
  const filter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setCursor("");
    setFilters({
      account_id: String(data.get("account_id")),
      from: String(data.get("from")),
      to: String(data.get("to")),
      category: String(data.get("category")),
      q: String(data.get("q")),
    });
  };
  return (
    <>
      <Card title="Search and filters">
        <form className="transaction-filters" onSubmit={filter}>
          <label className="search-field">
            Merchant or description
            <input
              name="q"
              placeholder="Search transactions"
              defaultValue={filters.q}
              maxLength={100}
            />
          </label>
          <label>
            Account
            <select name="account_id" defaultValue={filters.account_id}>
              <option value="">All linked accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {titleCase(a.kind)} · {a.last_four}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" name="from" defaultValue={filters.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={filters.to} />
          </label>
          <label>
            Category
            <select name="category" defaultValue="">
              <option value="">All categories</option>
              {[
                "income",
                "housing",
                "utilities",
                "insurance",
                "groceries",
                "dining",
                "transport",
                "shopping",
                "subscription",
                "transfer",
                "interest",
                "valuation",
                "demo_expense",
              ].map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Apply filters
          </button>
        </form>
      </Card>
      <Card
        title="Transaction history"
        action={
          <span className="small muted">30 months of fixture history</span>
        }
      >
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <Notice tone="error">{result.error}</Notice>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date / merchant</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th className="number">Ledger delta</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.data!.items.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="stack">
                          <strong>{t.merchant}</strong>
                          <span className="small muted">
                            {financialDate(t.posted_date)}
                          </span>
                        </div>
                      </td>
                      <td className="muted small">
                        {titleCase(
                          accounts.find((a) => a.id === t.account_id)?.kind ||
                            "account",
                        )}{" "}
                        ·{" "}
                        {accounts.find((a) => a.id === t.account_id)?.last_four}
                      </td>
                      <td>
                        <span className="category-tag">
                          {titleCase(t.category)}
                        </span>
                      </td>
                      <td
                        className={`number semibold ${t.category === "income" ? "positive" : ""}`}
                      >
                        {t.delta_cents > 0 ? "+" : ""}
                        {money(t.delta_cents)}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelected(t)}
                          aria-label={`Inspect ${t.merchant} on ${financialDate(t.posted_date)}`}
                        >
                          Inspect
                          <Icon name="arrow" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!result.data!.items.length && (
              <Empty
                title="No matching transactions"
                text="Try another date, account or merchant. Your filters are preserved."
                link={false}
              />
            )}
            <div className="table-footer">
              <span>{result.data!.items.length} records on this page</span>
              <div className="button-row">
                {cursor && (
                  <button
                    className="button secondary compact"
                    onClick={() => setCursor("")}
                  >
                    First page
                  </button>
                )}
                <button
                  className="button secondary compact"
                  onClick={() => setCursor(result.data!.next_cursor!)}
                  disabled={!result.data!.next_cursor}
                >
                  Next page <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
      <Notice>
        Positive deltas increase asset balances or debt owed. Negative deltas
        decrease them. Paired transfers are excluded from cash-flow totals.
      </Notice>
      {selected && (
        <Modal title="Transaction evidence" onClose={() => setSelected(null)}>
          <div className="detail-list">
            <span>
              Merchant<strong>{selected.merchant}</strong>
            </span>
            <span>
              Posted<strong>{financialDate(selected.posted_date)}</strong>
            </span>
            <span>
              Category<strong>{titleCase(selected.category)}</strong>
            </span>
            <span>
              Signed ledger delta<strong>{money(selected.delta_cents)}</strong>
            </span>
            <span>
              Source<strong>Simulated ledger</strong>
            </span>
          </div>
          {selected.transfer_group && (
            <Notice>
              This entry belongs to a paired owned-account transfer.
            </Notice>
          )}
        </Modal>
      )}
    </>
  );
}
export function Cash() {
  const { accounts, evidence } = useWorkspace();
  const [days, setDays] = useState(30);
  const forecast = useResource<Forecast>("forecast?days=" + days);
  if (!accounts.length) return <Empty />;
  return (
    <>
      <div className="section-toolbar">
        <div className="segmented" aria-label="Forecast horizon">
          {[30, 90].map((n) => (
            <button
              key={n}
              className={days === n ? "selected" : ""}
              onClick={() => setDays(n)}
              aria-pressed={days === n}
            >
              {n} days
            </button>
          ))}
        </div>
        <span className="small muted">
          Scheduled income and bills · UTC dates
        </span>
      </div>
      {forecast.error ? (
        <Notice tone="error">{forecast.error}</Notice>
      ) : !forecast.data ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid">
            <Stat
              label="Liquid cash now"
              value={money(forecast.data.dated_balances[0]?.balance_cents)}
              note="Checking + savings"
            />
            <Stat
              label="Lowest projected balance"
              value={money(forecast.data.low_cash_cents)}
              note={financialDate(forecast.data.low_cash_date)}
            />
            <Stat
              label="Forecast horizon"
              value={`${days} days`}
              note="Known scheduled items only"
            />
          </div>
          <div className="content-grid">
            <div className="content-column">
              <Card title="Dated liquid-cash forecast">
                <BalanceChart
                  points={forecast.data.dated_balances}
                  onEvidence={() => evidence(forecast.data!.evidence_ids[0])}
                />
              </Card>
              <Bills />
            </div>
            <aside className="inspector">
              <Card title="Account vs. whole picture">
                <p>
                  Savings does not automatically cover checking obligations.
                  This forecast combines linked liquid balances and does not
                  execute transfers.
                </p>
              </Card>
              <Card title="Forecast assumptions">
                <ul className="assumption-list">
                  {forecast.data.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Card>
              <Link className="button secondary full" href="/scenarios">
                Stress-test your cash <Icon name="arrow" size={16} />
              </Link>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
export function Assets() {
  const { accounts } = useWorkspace();
  const assets = accounts.filter(
    (a) => !["checking", "savings", ...liabilities].includes(a.kind),
  );
  return (
    <>
      <Summary />
      {assets.length ? (
        <Card title="Long-term and restricted assets">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Balance</th>
                  <th>Cash availability</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {titleCase(a.kind)} · •••• {a.last_four}
                    </td>
                    <td className="number">{money(a.balance_cents)}</td>
                    <td className="muted">Excluded from spendable cash</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Empty
          title="No investment or restricted accounts linked"
          text="Select an investment, retirement or CD account when connecting its institution."
        />
      )}
      <Notice>
        Valuations are simulated. Withdrawal restrictions, taxes, settlement and
        CD maturity must be reviewed before treating these assets as available
        cash.
      </Notice>
    </>
  );
}
