import { CoachPanel } from "../../src/components/chat/coach-panel";
import { AgentWorkspace } from "../../src/components/chat/agent-workspace";
import { PageHeading } from "../../src/components/page-heading";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "../../src/components/auth/auth-provider";
import { WorkspaceGate } from "../../src/components/auth/workspace-gate";
import { AppShell } from "../../src/components/app-shell";
import { InstitutionCatalog } from "../../src/components/connections/institution-catalog";
import { AccountConsent } from "../../src/components/connections/account-consent";
import { ConnectionManager } from "../../src/components/connections/connection-manager";
import { FinanceScope } from "../../src/components/finance/finance-scope";
import { OverviewScreen } from "../../src/components/finance/overview";
import { TransactionsScreen } from "../../src/components/finance/transactions";
import { CashScreen } from "../../src/components/finance/forecast";
import { AccountsScreen } from "../../src/components/finance/accounts";
import { SubscriptionsScreen } from "../../src/components/planning/subscriptions";
import { GoalsScreen } from "../../src/components/planning/goals-plans";
import {
  DebtsScreen,
  AssetsScreen,
  ScenariosScreen,
} from "../../src/components/planning/finance-pages";
import { AgentsScreen } from "../../src/components/planning/agents";
import {
  confirmedConnectionFixture,
  verifiedPreviewFixture,
} from "../fixtures/institutions";
import "../../src/app/globals.css";
import "../../src/components/auth/auth.css";
import "./fixture.css";

// Isolated test entry, never imported by src/app or shipped as an application route.
function Fixture() {
  const { state } = useAuth();
  const [mode, setMode] = useState(location.hash.slice(1));
  useEffect(() => {
    const update = () => setMode(location.hash.slice(1));
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const [preview] = useState(verifiedPreviewFixture);
  const [connection] = useState(confirmedConnectionFixture);
  const PlanningScreen = (
    {
      subscriptions: SubscriptionsScreen,
      goals: GoalsScreen,
      debts: DebtsScreen,
      assets: AssetsScreen,
      scenarios: ScenariosScreen,
      agents: AgentsScreen,
    } as Record<string, React.ComponentType>
  )[mode];
  if (state.status !== "authenticated")
    return (
      <WorkspaceGate>
        <span>Unreachable fixture</span>
      </WorkspaceGate>
    );
  return (
    <WorkspaceGate>
      <AppShell>
        <div className="page-stack">
          <p className="simulation-warning">
            Automated test fixture · not live integration. Session and backend
            responses are supplied only by tests.
          </p>
          {mode === "integrated" ? <AgentWorkspace /> : mode === "coach" ? <><PageHeading title="Ask about your next move" description="A conversation connected to your financial picture." /><CoachPanel /></> : PlanningScreen ? (
            <FinanceScope key={mode} allowEmpty>
              <PlanningScreen />
            </FinanceScope>
          ) : ["overview", "transactions", "cash", "accounts"].includes(
              mode,
            ) ? (
            <FinanceScope>
              {mode === "overview" ? (
                <OverviewScreen />
              ) : mode === "transactions" ? (
                <TransactionsScreen />
              ) : mode === "accounts" ? (
                <AccountsScreen />
              ) : (
                <CashScreen />
              )}
            </FinanceScope>
          ) : mode === "consent" ? (
            <>
              <h1>Choose the accounts to connect</h1>
              <AccountConsent
                preview={preview}
                csrfToken={state.session.csrfToken}
                onStartAgain={() => setMode("")}
              />
            </>
          ) : mode === "connection" ? (
            <>
              <h1>Connection details</h1>
              <ConnectionManager
                connection={connection}
                csrfToken={state.session.csrfToken}
                onReconnect={() => setMode("")}
              />
            </>
          ) : (
            <InstitutionCatalog />
          )}
        </div>
      </AppShell>
    </WorkspaceGate>
  );
}
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <Fixture />
  </AuthProvider>,
);
