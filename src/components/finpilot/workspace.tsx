"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  financialDate,
  newKey,
  titleCase,
  type Account,
  type Connection,
  type Institution,
  type Overview,
  type Profile,
} from "../../lib/finpilot";
import { WorkspaceContext, useResource } from "./context";
import { Card, Icon, Loading, Modal, Notice, useAction } from "./ui";
import {
  Accounts,
  Assets,
  Cash,
  OverviewScreen,
  Transactions,
} from "./finance-views";
import { Institutions, Settings, Subscriptions } from "./connection-views";
import { Calculators, Goals, Debt, Scenarios } from "./planning-views";
import { Agents, Chat } from "./agent-views";
const navigation = [
  ["overview", "Overview", "grid"],
  ["institutions", "Institutions", "bank"],
  ["accounts", "Accounts", "wallet"],
  ["transactions", "Transactions", "list"],
  ["cash", "Cash & bills", "calendar"],
  ["subscriptions", "Subscriptions", "repeat"],
  ["debt", "Debt & readiness", "trend"],
  ["goals", "Goals & plans", "target"],
  ["assets", "Assets", "wallet"],
  ["agents", "Agent workspace", "spark"],
  ["scenarios", "Scenario lab", "sliders"],
  ["settings", "Settings", "gear"],
];
const headers: Record<string, [string, string]> = {
  overview: [
    "A clearer next move starts here",
    "A financial picture you can inspect, not just a balance.",
  ],
  institutions: [
    "Connect your financial picture",
    "Choose the institutions and accounts you want to bring together.",
  ],
  accounts: [
    "Accounts with context",
    "Separate available cash, liabilities and restricted assets.",
  ],
  transactions: [
    "Every transaction, in its place",
    "Follow the details behind your financial picture.",
  ],
  cash: [
    "Your month, before it happens",
    "See the timing of your obligations and expected income.",
  ],
  subscriptions: [
    "Your recurring costs, made visible",
    "Keep what matters. Make the rest a conscious choice.",
  ],
  debt: [
    "Give every payment a purpose",
    "Understand your balances, interest and next steps.",
  ],
  goals: [
    "Your priorities, coordinated",
    "Make room for the things you are working toward.",
  ],
  assets: [
    "Assets, with their limitations",
    "Long-term value has a different role from everyday cash.",
  ],
  agents: [
    "Your financial team is at work",
    "Follow real activity and inspect the evidence behind each finding.",
  ],
  scenarios: [
    "Rehearse the unexpected",
    "See how a change in circumstances affects your cash.",
  ],
  settings: [
    "Your workspace, your access",
    "Manage your profile, session and institution consent.",
  ],
  chat: [
    "Ask about your next move",
    "A clear conversation. Your decisions stay yours.",
  ],
  calculators: [
    "Make your next move concrete",
    "Explore a payoff or savings goal with transparent calculations.",
  ],
};
export function Workspace({
  screen,
  profile,
}: {
  screen: string;
  profile: Profile;
}) {
  const router = useRouter(),
    action = useAction();
  const [epoch, setEpoch] = useState(0),
    [menu, setMenu] = useState(false),
    [toast, setToast] = useState(""),
    [evidenceId, setEvidenceId] = useState("");
  const accounts = useResource<{ items: Account[] }>("accounts", epoch),
    institutions = useResource<{ items: Institution[] }>("institutions", epoch),
    overview = useResource<Overview>("overview", epoch),
    connections = useResource<{ items: Connection[] }>("connections", epoch);
  const refresh = () => setEpoch((e) => e + 1);
  useEffect(() => {
    const expired = () => {
      router.replace("/sign-in");
      router.refresh();
    };
    window.addEventListener("finpilot:expired", expired);
    return () => window.removeEventListener("finpilot:expired", expired);
  }, [router]);
  useEffect(() => {
    setMenu(false);
    setEvidenceId("");
  }, [screen]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  const startRun = () =>
    void action.run(async () => {
      const r = await api<{ run_id: string }>("runs", "POST", {
        intent: "checkup",
        idempotency_key: action.key({ intent: "checkup" }),
      });
      router.push("/agents?run=" + encodeURIComponent(r.run_id));
    });
  const error =
    accounts.error || institutions.error || overview.error || connections.error;
  const ready =
    accounts.data && institutions.data && overview.data && connections.data;
  const primary =
    screen === "overview" ? (
      <button className="button" onClick={startRun} disabled={action.busy}>
        <Icon name="spark" size={17} />
        {action.busy ? "Starting…" : "Run financial checkup"}
      </button>
    ) : ["accounts", "assets"].includes(screen) ? (
      <Link className="button" href="/institutions">
        <Icon name="plus" size={16} />
        Connect an account
      </Link>
    ) : screen === "debt" ? (
      <Link className="button" href="/calculators">
        Open payoff calculator
        <Icon name="arrow" size={16} />
      </Link>
    ) : screen === "chat" ? (
      <button className="button" disabled={action.busy} onClick={startRun}>
        Request checkup
        <Icon name="spark" size={16} />
      </button>
    ) : null;
  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="nav-backdrop"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" href="/overview">
          <span className="brand-mark">
            <Icon name="spark" size={24} />
          </span>
          finpilot<span className="brand-period">.</span>
        </Link>
        <span className="sidebar-caption">FINANCIAL COMMAND CENTER</span>
        <nav aria-label="Main navigation">
          {navigation.map(([path, label, icon]) => (
            <Link
              key={path}
              href={"/" + path}
              aria-current={screen === path ? "page" : undefined}
              className={screen === path ? "active" : ""}
            >
              <Icon name={icon} size={19} />
              <span>{label}</span>
              {screen === path && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <Icon name="shield" size={20} />
            <div>
              <strong>You’re in control</strong>
              <span>Your plan. Your approval.</span>
            </div>
          </div>
          <div className="sidebar-profile">
            <span className="avatar">
              {profile.display_name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{profile.display_name}</strong>
              <span>Personal workspace</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <span className="breadcrumb">
              Personal workspace <span>/</span>{" "}
              <strong>{profile.display_name}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="badge">
              <span className="dot" /> SIMULATED DATA
            </span>
            <Link
              className={`chat-link ${screen === "chat" ? "selected" : ""}`}
              href="/chat"
            >
              <Icon name="chat" size={18} />
              <span>Ask FinPilot</span>
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR FINANCIAL PICTURE</span>
              <h1>{headers[screen][0]}</h1>
              <p className="subtitle">{headers[screen][1]}</p>
            </div>
            {primary}
          </div>
          {action.error && <Notice tone="error">{action.error}</Notice>}
          {toast && <Notice tone="success">{toast}</Notice>}
          {error ? (
            <Card>
              <Notice tone="error">{error}</Notice>
              <button className="button secondary" onClick={refresh}>
                Try again
              </button>
            </Card>
          ) : !ready ? (
            <Loading />
          ) : (
            <WorkspaceContext.Provider
              value={{
                profile,
                accounts: accounts.data!.items,
                connections: connections.data!.items,
                institutions: institutions.data!.items,
                overview: overview.data!,
                refresh,
                notify: setToast,
                evidence: setEvidenceId,
              }}
            >
              <div className="snapshot-line">
                <span>
                  <span className="dot" /> User-selected accounts only
                </span>
                <span>
                  Fixture as of {financialDate(overview.data!.as_of)}{" "}
                  <span className="separator">·</span> Snapshot{" "}
                  {overview.data!.snapshot_version}
                </span>
              </div>
              {screen === "overview" ? (
                <OverviewScreen />
              ) : screen === "institutions" ? (
                <Institutions />
              ) : screen === "accounts" ? (
                <Accounts />
              ) : screen === "transactions" ? (
                <Transactions />
              ) : screen === "cash" ? (
                <Cash />
              ) : screen === "subscriptions" ? (
                <Subscriptions />
              ) : screen === "debt" ? (
                <Debt />
              ) : screen === "goals" ? (
                <Goals />
              ) : screen === "assets" ? (
                <Assets />
              ) : screen === "agents" ? (
                <Agents />
              ) : screen === "scenarios" ? (
                <Scenarios />
              ) : screen === "settings" ? (
                <Settings />
              ) : screen === "chat" ? (
                <Chat />
              ) : (
                <Calculators />
              )}
            </WorkspaceContext.Provider>
          )}
          <footer className="page-footer">
            <span>
              <Icon name="shield" size={14} /> Your data stays in your selected
              scope.
            </span>
            <span>Independent prototype · No real financial transactions</span>
          </footer>
        </main>
      </div>
      {evidenceId && (
        <Evidence id={evidenceId} close={() => setEvidenceId("")} />
      )}
    </div>
  );
}
function Evidence({ id, close }: { id: string; close: () => void }) {
  const result = useResource<{
    kind: string;
    source_id: string;
    source_mode: string;
    observed_at: string;
    payload_json: string;
  }>("evidence/" + encodeURIComponent(id));
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(result.data?.payload_json || "{}");
  } catch {}
  return (
    <Modal title="Why this result exists" onClose={close}>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Notice tone="error">
          This evidence is unavailable or its account access has changed.
          Refresh the workspace before running another checkup.
        </Notice>
      ) : (
        <>
          <div className="detail-list">
            <span>
              Source mode<strong>{titleCase(result.data!.source_mode)}</strong>
            </span>
            <span>
              Evidence type<strong>{titleCase(result.data!.kind)}</strong>
            </span>
            <span>
              Observed
              <strong>
                {new Date(result.data!.observed_at).toLocaleString("en-US", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </strong>
            </span>
          </div>
          <h3>Calculation assumptions</h3>
          <ul className="assumption-list">
            {Array.isArray(payload.assumptions) ? (
              payload.assumptions.map((a, i) => <li key={i}>{String(a)}</li>)
            ) : (
              <li>
                Source-scoped evidence from your current financial snapshot.
              </li>
            )}
          </ul>
          <details>
            <summary>View calculation record</summary>
            <pre className="evidence-record">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details>
        </>
      )}
    </Modal>
  );
}
