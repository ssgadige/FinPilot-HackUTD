"use client";
import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { useFinanceScope } from "@/components/finance/finance-scope";
import { FinanceError } from "@/lib/finance-api";
import {
  workspaceApi,
  workspaceRequest,
  workspaceMessage,
  type RunView,
} from "@/lib/workspace-api";
import type { RunEvent } from "../../../contracts/types";
import { Sources, EvidenceLinks } from "./shared";
import { useWorkspaceAction } from "./workspace-state";

const roles = [
  ["data-integrity", "Data Integrity"],
  ["cash-collision", "Cash Collision"],
  ["subscription-detective", "Subscription Detective"],
  ["deal-scout", "Deal Scout"],
  ["debt-readiness", "Debt and Purchase Readiness"],
  ["goal-allocator", "Goal Negotiator"],
  ["stress-test", "Stress-Test"],
  ["plan-repair", "Plan Repair"],
  ["coordinator", "Coordinator"],
] as const;
export type FindingContext = {
  runId: string;
  findingId: string;
  evidenceIds: string[];
};
/** Teammate-owned chat slot. No model client, alternate provider or chat backend is created here. */
export function ChatBoundary({ context }: { context?: FindingContext }) {
  return (
    <details open={Boolean(context)}>
      <summary>Chat integration</summary>
      <h2>Chat panel unavailable</h2>
      <p>
        The full chatbot is owned by the parallel chat implementation. No chat
        component or HTTP route is exposed in this checkout. No reply or typing
        state is simulated.
      </p>
      {context && (
        <p>
          Selected finding reference: <code>{context.findingId}</code> ·{" "}
          {context.evidenceIds.length} scoped evidence references ready for the
          teammate’s explain-finding interface.
        </p>
      )}
      <p>
        Only Nemotron may supply model responses. Financial source labels remain
        independent of model execution status.
      </p>
    </details>
  );
}
export function AgentsScreen() {
  const { accounts } = useFinanceScope();
  const action = useWorkspaceAction();
  const [draft, setDraft] = useState(""),
    [id, setId] = useState(""),
    [missing, setMissing] = useState(false);
  return (
    <div className="page-stack planning-page">
      <PageHeading
        title="Your financial team, with visible evidence"
        description="Eight specialists and a coordinator. Only server-reported execution and findings appear here."
        action={
          <Button
            disabled={action.busy || missing || !accounts.items.length}
            onClick={() =>
              void action.run(
                (s, csrf) =>
                  workspaceRequest("runs", s, {
                    method: "POST",
                    csrf,
                    body: {
                      intent: "financial_checkup",
                      idempotency_key: crypto.randomUUID(),
                    },
                  }),
                (d) => {
                  if (
                    d &&
                    typeof d === "object" &&
                    "run_id" in d &&
                    typeof d.run_id === "string"
                  )
                    setId(d.run_id);
                },
                () => setMissing(true),
              )
            }
          >
            {action.busy ? "Requesting checkup…" : "Run checkup"}
          </Button>
        }
      />
      <Sources />
      <Card>
        <h2>Run service dependency</h2>
        <p>
          The agent runtime exists, but this checkout exposes no authenticated
          run or chat HTTP handlers. Checkup execution, server event envelopes
          and the teammate’s chat integration must be connected before this task
          can be fully verified.
        </p>
        {!accounts.items.length && (
          <p>
            Connect and verify an institution before requesting a financial
            checkup.
          </p>
        )}
        {action.error && <p role="alert">{action.error}</p>}
        <form
          className="planning-form"
          onSubmit={(e) => {
            e.preventDefault();
            setId(draft.trim());
          }}
        >
          <FormField
            label="Existing authorized run ID"
            value={draft}
            maxLength={128}
            onChange={(e) => setDraft(e.target.value)}
            required
          />
          <Button type="submit">Inspect run availability</Button>
        </form>
      </Card>
      {id ? (
        <RunPanel key={id} id={id} />
      ) : (
        <div className="planning-role-list">
          {roles.map(([key, label]) => (
            <section key={key} className="planning-role">
              <h2>{label}</h2>
              <p>Status: Not reported</p>
              <p className="small muted">
                No run response. A role card does not mean the agent is queued
                or complete.
              </p>
            </section>
          ))}
        </div>
      )}
      <ChatBoundary />
    </div>
  );
}
export function RunPanel({ id }: { id: string }) {
  const { accounts, epoch, currentEpoch, fail } = useFinanceScope();
  const [run, setRun] = useState<RunView | null>(null),
    [events, setEvents] = useState<RunEvent[]>([]),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [retry, setRetry] = useState(0),
    [explain, setExplain] = useState<FindingContext>();
  const active = useRef(true);
  useEffect(() => {
    const c = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined,
      cursor: string | null = null,
      calls = 0,
      failures = 0;
    active.current = true;
    async function poll() {
      if (c.signal.aborted || currentEpoch() !== epoch || !active.current)
        return;
      let terminal = false;
      try {
        const view = await workspaceApi.run(id, c.signal);
        if (c.signal.aborted || currentEpoch() !== epoch || !active.current)
          return;
        setRun(view);
        terminal = ["completed", "failed", "cancelled", "partial"].includes(
          view.status,
        );
        const stream = await workspaceApi.events(id, cursor, c.signal);
        if (c.signal.aborted || currentEpoch() !== epoch || !active.current)
          return;
        setRun(view);
        setError("");
        setEvents((old) => {
          const map = new Map(old.map((e) => [e.id, e]));
          stream.items.forEach((e) => map.set(e.id, e));
          return [...map.values()].slice(-200);
        });
        cursor = stream.next_cursor;
        failures = 0;
        calls++;
        if (
          ["completed", "failed", "cancelled", "partial"].includes(view.status)
        )
          return;
        if (calls >= 60) {
          setError(
            "Polling limit reached. Inspect again to request current status.",
          );
          return;
        }
      } catch (e) {
        if (c.signal.aborted || currentEpoch() !== epoch) return;
        setError(workspaceMessage(e));
        failures++;
        if (
          e &&
          typeof e === "object" &&
          "status" in e &&
          (e.status === 401 || e.status === 403)
        ) {
          fail(new FinanceError(e.status === 401 ? "auth" : "revoked"));
          return;
        }
        if (terminal || failures >= 3) return;
      }
      if (active.current)
        timer = setTimeout(
          () => void poll(),
          Math.min(10000, 2000 * 2 ** failures),
        );
    }
    void poll();
    return () => {
      active.current = false;
      c.abort();
      if (timer) clearTimeout(timer);
    };
  }, [id, retry, epoch, currentEpoch, fail]);
  return (
    <div className="page-stack">
      <Card>
        <div className="finance-toolbar">
          <h2>Run status: {run?.status ?? "Unavailable until confirmed"}</h2>
          <Button
            variant="secondary"
            onClick={() => {
              active.current = false;
              setPaused(true);
            }}
          >
            Pause local polling
          </Button>
        </div>
        <p>
          Pausing polling does not cancel server execution. A cancellation
          endpoint is not currently available.
        </p>
        {error && <p role="alert">{error}</p>}
        {(error || paused) && (
          <Button
            onClick={() => {
              setPaused(false);
              setRetry((v) => v + 1);
            }}
          >
            Refresh run status
          </Button>
        )}
        {run && (
          <>
            <p>
              Financial snapshot {run.snapshot_version}:{" "}
              {run.snapshot_version === accounts.snapshot_version
                ? "current"
                : "Stale — accounts changed"}
            </p>
            <p>
              Model execution: {run.model_status ?? "Not reported"} · Financial
              source remains separately labeled.
            </p>
            {run.partial && (
              <p role="status">
                Partial results; some dependencies may have failed or been
                skipped.
              </p>
            )}
          </>
        )}
      </Card>
      <div className="planning-grid">
        {roles.map(([key, label]) => {
          const step = run?.steps.find((s) => s.agent_id === key);
          return (
            <Card key={key} className="planning-role">
              <h2>{label}</h2>
              <p>Status: {step?.status ?? "Not reported"}</p>
              {step?.result && (
                <>
                  <p>{step.result.headline}</p>
                  <p>
                    Assumptions:{" "}
                    {step.result.assumptions.join("; ") || "None reported"}
                  </p>
                  <p>
                    Missing inputs:{" "}
                    {step.result.missing_data.join("; ") || "None reported"}
                  </p>
                  {step.result.findings.map((f) => (
                    <div key={f.id}>
                      <h3>{f.summary}</h3>
                      <EvidenceLinks ids={f.evidence_ids} />
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setExplain({
                            runId: id,
                            findingId: f.id,
                            evidenceIds: f.evidence_ids,
                          })
                        }
                      >
                        Prepare explanation reference
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </Card>
          );
        })}
      </div>
      <Card>
        <h2>Reported tool activity and handoffs</h2>
        {events.length ? (
          <ol>
            {events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.at}>{e.at}</time> · {e.agent_id} · {e.type}
                <p>{e.message}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            No server events have been returned. No progress or dependency
            handoff is inferred.
          </p>
        )}
      </Card>
      {explain && <ChatBoundary context={explain} />}
    </div>
  );
}
