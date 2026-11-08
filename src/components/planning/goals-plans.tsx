"use client";
import { useRef, useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, SelectField } from "@/components/ui/form-field";
import { DataTable } from "@/components/ui/data-table";
import { useFinanceScope } from "@/components/finance/finance-scope";
import { usd } from "@/lib/finance-api";
import {
  workspaceApi,
  workspaceRequest,
  savedRecord,
  WorkspaceProblem,
  inputCents,
  type Goal,
  type Plan,
} from "@/lib/workspace-api";
import { ReviewDialog } from "./modal";
import { Sources, SafetyNote, EvidenceLinks } from "./shared";
import {
  ResourceState,
  useWorkspaceRead,
  useWorkspaceAction,
} from "./workspace-state";
export function GoalsScreen() {
  const r = useWorkspaceRead("goals", workspaceApi.goals);
  const [edit, setEdit] = useState<Goal | null | undefined>();
  return (
    <div className="page-stack planning-page">
      <PageHeading
        title="Your priorities, coordinated"
        description="Goals share the same available dollars. Confirmed savings and proposed allocations stay separate."
        action={<Button onClick={() => setEdit(null)}>Create goal</Button>}
      />
      <Sources />
      {r.data ? (
        <div className="planning-grid">
          {r.data.length ? (
            r.data.map((g) => (
              <Card key={g.id}>
                <h2>{g.title}</h2>
                <p className="planning-value">
                  {usd(g.saved_cents)}{" "}
                  <span className="small">saved of {usd(g.target_cents)}</span>
                </p>
                {typeof g.saved_cents === "number" && (
                  <progress
                    aria-label={g.title + " saved progress"}
                    max={g.target_cents}
                    value={g.saved_cents}
                  />
                )}
                <p>
                  Deadline: {g.deadline} · Priority: {g.priority}
                </p>
                <Button variant="secondary" onClick={() => setEdit(g)}>
                  Edit {g.title}
                </Button>
              </Card>
            ))
          ) : (
            <Card>
              <h2>No goals yet</h2>
              <p>
                Create a goal to give your next decision a clear target.
                Creating a goal does not reserve or transfer money.
              </p>
            </Card>
          )}
        </div>
      ) : (
        <ResourceState {...r} />
      )}
      <PlansPanel />
      <SafetyNote />
      {edit !== undefined && (
        <GoalEditor goal={edit} onClose={() => setEdit(undefined)} />
      )}
    </div>
  );
}
function GoalEditor({
  goal,
  onClose,
}: {
  goal: Goal | null;
  onClose: () => void;
}) {
  const { refresh } = useFinanceScope();
  const action = useWorkspaceAction();
  const [title, setTitle] = useState(goal?.title ?? ""),
    [target, setTarget] = useState(
      goal ? (goal.target_cents / 100).toFixed(2) : "",
    ),
    [deadline, setDeadline] = useState(goal?.deadline ?? ""),
    [priority, setPriority] = useState(goal?.priority ?? 3),
    [error, setError] = useState("");
  return (
    <ReviewDialog title={goal ? "Edit goal" : "Create goal"} onClose={onClose}>
      <form
        className="planning-form"
        onSubmit={(e) => {
          e.preventDefault();
          const cents = inputCents(target);
          if (
            !title.trim() ||
            title.trim().length > 200 ||
            cents === null ||
            cents <= 0 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(deadline)
          ) {
            setError(
              "Enter a title, a positive USD target and a valid deadline.",
            );
            return;
          }
          setError("");
          void action.run(
            (s, csrf) =>
              workspaceRequest(
                "goals" + (goal ? "/" + encodeURIComponent(goal.id) : ""),
                s,
                {
                  method: goal ? "PATCH" : "POST",
                  csrf,
                  body: {
                    title: title.trim(),
                    target_cents: cents,
                    deadline,
                    priority,
                  },
                },
              ),
            (data) => {
              savedRecord(data, goal?.id);
              onClose();
              refresh();
            },
          );
        }}
      >
        <FormField
          label="Goal title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <FormField
          label="Target amount (USD)"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          required
        />
        <FormField
          type="date"
          label="Goal deadline"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
        />
        <SelectField
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map((p) => (
            <option value={p} key={p}>
              {p}
              {p === 1 ? " · highest" : ""}
            </option>
          ))}
        </SelectField>
        <p>
          Saving this goal confirms your target, not a transfer or guaranteed
          completion date.
        </p>
        <Button type="submit" disabled={action.busy}>
          {action.busy ? "Saving…" : "Save goal"}
        </Button>
        {(error || action.error) && <p role="alert">{error || action.error}</p>}
      </form>
    </ReviewDialog>
  );
}
export function PlansPanel() {
  const r = useWorkspaceRead("plans", workspaceApi.plans);
  const { accounts } = useFinanceScope();
  const [review, setReview] = useState<Plan | null>(null);
  const [conflict, setConflict] = useState(false);
  return (
    <Card>
      <h2>Plans and allocation tradeoffs</h2>
      {conflict && (
        <p role="alert">
          The plan changed. Latest versions have been requested. Review a
          current proposal and confirm again; acceptance was not retried.
        </p>
      )}
      <p>
        Compare existing server proposals. Allocations in alternative plans are
        mutually exclusive; do not add their budgets together.
      </p>
      {r.data ? (
        r.data.length ? (
          <div className="page-stack">
            {r.data.map((p) => (
              <Card key={p.id}>
                <h3>
                  Plan version {p.version} · {p.status}
                </h3>
                <p>
                  Snapshot {p.snapshot_version} ·{" "}
                  {p.stale || p.snapshot_version !== accounts.snapshot_version
                    ? "Stale — request a current proposal"
                    : "Matches current account snapshot"}
                </p>
                {p.payload && (
                  <>
                    <p>Reserved cash buffer: {usd(p.payload.reserve_cents)}</p>
                    <DataTable
                      caption={"Plan " + p.id + " allocations"}
                      rows={p.payload.allocations}
                      rowKey={(a) => a.kind + ":" + a.target_id}
                      columns={[
                        {
                          key: "kind",
                          label: "Allocation",
                          render: (a) => a.kind.replaceAll("_", " "),
                        },
                        {
                          key: "amount",
                          label: "Monthly reserve",
                          render: (a) => usd(a.monthly_cents),
                          numeric: true,
                        },
                        {
                          key: "day",
                          label: "Monthly due day",
                          render: (a) => a.day_of_month,
                        },
                      ]}
                    />
                    <p>{p.payload.assumptions.join("; ")}</p>
                    <EvidenceLinks ids={p.payload.evidence_ids} />
                  </>
                )}
                <Button
                  variant="secondary"
                  disabled={
                    p.stale ||
                    p.snapshot_version !== accounts.snapshot_version ||
                    p.status !== "proposed"
                  }
                  onClick={() => setReview(p)}
                >
                  Review plan version {p.version}
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <p>
            No plan proposals are available. A proposal must come from an
            implemented authorized planning run; none is generated in the
            browser.
          </p>
        )
      ) : (
        <ResourceState {...r} />
      )}{" "}
      {review && (
        <AcceptPlan
          plan={review}
          onClose={() => setReview(null)}
          onConflict={() => {
            setReview(null);
            setConflict(true);
            r.retry();
          }}
        />
      )}
    </Card>
  );
}
function AcceptPlan({
  plan,
  onClose,
  onConflict,
}: {
  plan: Plan;
  onClose: () => void;
  onConflict: () => void;
}) {
  const action = useWorkspaceAction(),
    { refresh } = useFinanceScope();
  const [confirmed, setConfirmed] = useState(false),
    [saved, setSaved] = useState(false);
  const key = useRef<string | null>(null);
  return (
    <ReviewDialog
      title={"Accept plan version " + plan.version}
      onClose={() => {
        onClose();
        if (saved) refresh();
      }}
    >
      <p>
        Review snapshot {plan.snapshot_version}. Acceptance saves this FinPilot
        plan; no payment or transfer executes.
      </p>
      <label className="planning-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={saved || action.busy}
        />
        I reviewed this exact version and its assumptions.
      </label>
      <Button
        disabled={!confirmed || action.busy || saved}
        onClick={() => {
          key.current ??= crypto.randomUUID();
          void action.run(
            (s, csrf) =>
              workspaceRequest(
                "plans/" + encodeURIComponent(plan.id) + "/accept",
                s,
                {
                  method: "POST",
                  csrf,
                  body: {
                    expected_version: plan.version,
                    confirmation: true,
                    idempotency_key: key.current,
                  },
                },
              ),
            (data) => {
              savedRecord(data, plan.id, "accepted");
              setSaved(true);
            },
            (error) => {
              if (error instanceof WorkspaceProblem && error.status === 409) {
                setConfirmed(false);
                onConflict();
              }
            },
          );
        }}
      >
        {saved
          ? "Plan accepted"
          : action.busy
            ? "Accepting…"
            : "Accept reviewed plan"}
      </Button>
      {saved && (
        <p role="status">
          The server accepted the plan. Close to refresh the authoritative plan
          list.
        </p>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </ReviewDialog>
  );
}
