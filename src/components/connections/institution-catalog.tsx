"use client";

import { useEffect, useRef, useState } from "react";
import {
  Landmark,
  CreditCard,
  ChartNoAxesCombined,
  House,
  Wallet,
  ArrowRight,
  Search,
} from "lucide-react";
import {
  connectionsApi,
  connectionProblem,
  type ConnectionProblem,
  type Institution,
  type InstitutionCategory,
} from "@/lib/connections-api";
import { useAuth } from "@/components/auth/auth-provider";
import { WorkspaceGate } from "@/components/auth/workspace-gate";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form-field";
import { DataState } from "@/components/ui/data-state";
import { DecisionControls } from "@/components/decision-controls";
import { ProviderLinkDialog } from "./provider-link-dialog";
import "./connections.css";

const categories = [
  {
    id: "banks",
    label: "Banks",
    detail: "Checking, savings & CDs",
    icon: Landmark,
  },
  {
    id: "cards",
    label: "Cards",
    detail: "Standalone card providers",
    icon: CreditCard,
  },
  {
    id: "investments",
    label: "Investments",
    detail: "Long-term asset snapshots",
    icon: ChartNoAxesCombined,
  },
  { id: "loans", label: "Loans", detail: "Borrowing & repayment", icon: House },
  {
    id: "wallets",
    label: "Wallets",
    detail: "Digital wallet records",
    icon: Wallet,
  },
] as const;
type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; providers: Institution[] }
  | { kind: "error"; problem: ConnectionProblem };

export function InstitutionCatalog() {
  const { state } = useAuth();
  const [catalog, setCatalog] = useState<CatalogState>({ kind: "loading" });
  const [category, setCategory] = useState<InstitutionCategory>("banks");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Institution | null>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (state.status !== "authenticated") return;
    const controller = new AbortController();
    request.current = controller;
    void connectionsApi
      .institutions({ signal: controller.signal })
      .then((providers) => {
        if (!controller.signal.aborted)
          setCatalog({ kind: "ready", providers });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCatalog({ kind: "error", problem: connectionProblem(error) });
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [state.status]);
  function retry() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setCatalog({ kind: "loading" });
    void connectionsApi
      .institutions({ signal: controller.signal })
      .then((providers) => {
        if (!controller.signal.aborted)
          setCatalog({ kind: "ready", providers });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setCatalog({ kind: "error", problem: connectionProblem(error) });
      });
  }
  const providers =
    catalog.kind === "ready"
      ? catalog.providers.filter(
          (provider) =>
            provider.category === category &&
            provider.name
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
        )
      : [];
  return (
    <WorkspaceGate>
      <div className="page-stack">
        <PageHeading
          title="Connect your financial picture"
          description="Select an institution category, then a simulated provider."
        />
        <p className="simulation-warning">
          Simulation only. Do not enter real banking credentials.
        </p>
        <nav
          aria-label="Institution categories"
          className="institution-categories"
        >
          {categories.map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="institution-category"
              aria-pressed={category === id}
              onClick={() => {
                setCategory(id);
                setSearch("");
              }}
            >
              <Icon size={22} aria-hidden="true" />
              <strong>{label}</strong>
              <span className="small muted">{detail}</span>
            </button>
          ))}
        </nav>
        <div className="decision-grid">
          <div className="page-stack">
            <Card>
              <h2>Find an institution</h2>
              <FormField
                label="Search providers"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Bank name or provider"
                hint={`Search within ${categories.find((item) => item.id === category)?.label}.`}
              />
              <div className="small muted">
                <Search size={14} aria-hidden="true" /> Bank-issued cards remain
                under their issuing bank.
              </div>
            </Card>
            <Card>
              <div className="card-heading">
                <h2>
                  {category === "banks"
                    ? "Banks and credit unions"
                    : `${categories.find((item) => item.id === category)?.label} providers`}
                </h2>
                <Badge>Simulated providers</Badge>
              </div>
              {catalog.kind === "loading" ? (
                <DataState state="loading" title="Loading institutions">
                  Fetching the provider directory.
                </DataState>
              ) : catalog.kind === "error" ? (
                <DataState
                  state="error"
                  title="Institution directory unavailable"
                  action={
                    <Button onClick={retry} variant="secondary">
                      Retry directory
                    </Button>
                  }
                >
                  {catalog.problem.message}
                </DataState>
              ) : providers.length === 0 ? (
                <DataState state="empty" title="No matching providers">
                  Try another name or category.
                </DataState>
              ) : (
                <>
                  <p className="small muted" role="status">
                    {providers.length} providers in this view.
                  </p>
                  <ul className="provider-grid">
                    {providers.map((provider) => (
                      <li key={provider.id}>
                        <div className="provider-tile">
                          <div className="provider-monogram" aria-hidden="true">
                            {provider.name
                              .split(" ")
                              .map((word) => word[0])
                              .slice(0, 2)
                              .join("")}
                          </div>
                          <h3>{provider.name}</h3>
                          <p className="small muted">
                            Connection status unavailable
                          </p>
                          <Button
                            variant="secondary"
                            onClick={(event) => {
                              lastTrigger.current = event.currentTarget;
                              setSelected(provider);
                            }}
                            aria-label={`Connect ${provider.name}`}
                          >
                            Connect <ArrowRight size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
          <div className="page-stack">
            <Card>
              <h2>Your consent stays specific</h2>
              <p className="muted">
                Choose exactly which accounts and records FinPilot can read,
                after institution email verification.
              </p>
            </Card>
            <Card>
              <h2>Connection status unavailable</h2>
              <p className="muted">
                A connection-listing and status contract has not been supplied.
                Existing connections and their sync times cannot be confirmed
                here.
              </p>
            </Card>
            <Card>
              <h2>Institution verification required</h2>
              <p className="muted">
                The institution verify/resend integration is pending. No account
                selection or access is granted by this catalog.
              </p>
            </Card>
            <DecisionControls />
          </div>
        </div>
        {selected && state.status === "authenticated" && (
          <ProviderLinkDialog
            key={selected.id}
            provider={selected}
            csrfToken={state.session.csrfToken}
            onClose={() => {
              setSelected(null);
              lastTrigger.current?.focus();
            }}
          />
        )}
      </div>
    </WorkspaceGate>
  );
}
