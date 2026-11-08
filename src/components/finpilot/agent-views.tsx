"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  newKey,
  titleCase,
  type Event as RunEvent,
  type Run,
} from "../../lib/finpilot";
import type { AgentResult } from "../../../contracts/types";
import { useWorkspace } from "./context";
import { Card, Icon, Notice, Stat, useAction } from "./ui";
const roles = [
  "coordinator",
  "data-integrity",
  "cash-collision",
  "subscription-detective",
  "deal-scout",
  "debt-readiness",
  "goal-allocator",
  "stress-test",
  "plan-repair",
];
const roleDescriptions = [
  "Coordinates one evidence-backed result",
  "Checks the integrity of your records",
  "Inspects the timing of income and bills",
  "Reviews recurring candidates and usage",
  "Compares verified offer terms",
  "Explores payment and purchase readiness",
  "Coordinates your competing priorities",
  "Rehearses explicit adverse scenarios",
  "Proposes revisions when data changes",
];
export function Agents() {
  const params = useSearchParams(),
    router = useRouter(),
    { evidence } = useWorkspace();
  const runId = params.get("run") || "";
  const [run, setRun] = useState<Run | null>(null),
    [events, setEvents] = useState<RunEvent[]>([]),
    [error, setError] = useState("");
  const action = useAction();
  useEffect(() => {
    setRun(null);
    setEvents([]);
    setError("");
    if (!runId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cursor = "";
    const collected: RunEvent[] = [];
    const poll = async () => {
      try {
        const [r, e] = await Promise.all([
          api<Run>(
            "runs/" + encodeURIComponent(runId),
            "GET",
            undefined,
            controller.signal,
          ),
          api<{ items: RunEvent[]; next_cursor: string | null }>(
            "runs/" +
              encodeURIComponent(runId) +
              "/events" +
              (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
            "GET",
            undefined,
            controller.signal,
          ),
        ]);
        if (controller.signal.aborted) return;
        setRun(r);
        for (const event of e.items)
          if (!collected.some((old) => old.id === event.id))
            collected.push(event);
        cursor = e.next_cursor || cursor;
        setEvents([...collected]);
        if (
          ["queued", "running", "cancelling"].includes(r.status) ||
          e.items.length === 200
        )
          timer = setTimeout(poll, e.items.length === 200 ? 0 : 2000);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load this run.");
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [runId]);
  const start = () =>
    void action.run(async () => {
      const result = await api<{ run_id: string }>("runs", "POST", {
        intent: "checkup",
        idempotency_key: action.key({ intent: "checkup" }),
      });
      router.push("/agents?run=" + encodeURIComponent(result.run_id));
    });
  const results: AgentResult[] =
    run?.steps.flatMap((s) => {
      try {
        return s.result_json ? [JSON.parse(s.result_json)] : [];
      } catch {
        return [];
      }
    }) || [];
  const live =
    !!run && ["queued", "running", "cancelling"].includes(run.status);
  return (
    <>
      <div className="section-toolbar">
        <span className="small muted">
          {runId ? "Your selected financial run" : "No run selected"}
        </span>
        <div className="button-row">
          {live && (
            <button
              className="button secondary"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  const cancelled = await api<Run>(
                    "runs/" + runId + "/cancel",
                    "POST",
                    {},
                  );
                  setRun(cancelled);
                })
              }
            >
              Cancel run
            </button>
          )}
          <button
            className="button"
            onClick={start}
            disabled={action.busy || live}
          >
            <Icon name="spark" size={16} />
            {action.busy ? "Submitting…" : "Start a checkup"}
          </button>
        </div>
      </div>
      {(error || action.error) && (
        <Notice tone="error">{error || action.error}</Notice>
      )}
      {run?.stale && (
        <Notice tone="warning">
          This run used an older snapshot. Findings are withheld until you run a
          new checkup.
        </Notice>
      )}
      {run?.error_code && (
        <Notice tone="warning">
          {run.error_code === "runtime_unavailable"
            ? "The specialist runtime is not installed. No specialist findings or repair proposal were generated. Your saved goals and accepted plan are preserved."
            : `This run did not complete (${titleCase(run.error_code)}). Review your data and try again.`}
        </Notice>
      )}
      <div className="stats-grid">
        <Stat
          label="Run status"
          value={
            run ? titleCase(run.status) : runId ? "Loading…" : "Not started"
          }
          note="Real persisted status"
        />
        <Stat
          label="Completed roles"
          value={`${run?.steps.filter((s) => s.status === "completed").length || 0} of ${roles.length}`}
          note="Completed outputs only"
        />
        <Stat
          label="Run snapshot"
          value={run ? `v${run.snapshot_version}` : "—"}
          note={
            run?.stale
              ? "A newer financial snapshot exists"
              : "Simulated financial inputs"
          }
        />
      </div>
      <div className="content-grid">
        <div className="content-column">
          <Card title="Your specialist team">
            <div className="agent-grid">
              {roles.map((role, i) => {
                const step = run?.steps.find((s) => s.agent_id === role);
                const observed = events
                  .filter((e) => e.agent_id === role)
                  .at(-1);
                const status =
                  step?.status ||
                  (!run
                    ? "Not started"
                    : role === "coordinator"
                      ? run.status
                      : observed &&
                          ["completed", "failed", "skipped"].includes(
                            observed.type,
                          )
                        ? observed.type
                        : observed &&
                            [
                              "started",
                              "tool_started",
                              "tool_completed",
                            ].includes(observed.type)
                          ? "Running"
                          : "Not started");
                return (
                  <div className="agent-card" key={role}>
                    <div className="split">
                      <span className="agent-glyph">
                        <Icon
                          name={i === 0 ? "spark" : i % 2 ? "shield" : "target"}
                          size={20}
                        />
                      </span>
                      <span
                        className={`status-pill ${status === "completed" ? "success" : status === "failed" ? "warning" : ""}`}
                      >
                        {titleCase(status)}
                      </span>
                    </div>
                    <h3>{titleCase(role)}</h3>
                    <p>{roleDescriptions[i]}</p>
                  </div>
                );
              })}
            </div>
          </Card>
          {results.length > 0 && (
            <Card title="Findings backed by evidence">
              {results.map((r) => (
                <div key={r.agent_id} className="finding">
                  <h3>{r.headline}</h3>
                  {r.findings.map((f) => (
                    <div key={f.id}>
                      <p>{f.summary}</p>
                      <div className="button-row">
                        {f.evidence_ids.map((id) => (
                          <button
                            key={id}
                            className="text-button"
                            onClick={() => evidence(id)}
                          >
                            Inspect evidence
                            <Icon name="arrow" size={14} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {r.missing_data.length > 0 && (
                    <Notice tone="warning">
                      Missing information: {r.missing_data.join(" · ")}
                    </Notice>
                  )}
                </div>
              ))}
            </Card>
          )}
          <Card title="Actual activity">
            <ol className="activity-list">
              {events.map((e) => (
                <li key={e.id}>
                  <span
                    className={`activity-dot ${e.type === "failed" ? "failed" : ""}`}
                  />
                  <div>
                    <strong>{titleCase(e.agent_id)}</strong>
                    <p>{e.message}</p>
                    <span>
                      {new Date(e.at).toLocaleTimeString("en-US")} ·{" "}
                      {titleCase(e.type)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            {!events.length && (
              <p className="muted">
                Real tool and model activity appears here after a run starts.
              </p>
            )}
          </Card>
        </div>
        <aside className="inspector">
          <Card title="A clear handoff">
            <p>
              Specialists can use prior results to build one coordinated plan.
              Displayed status comes from actual run events.
            </p>
          </Card>
          <Card title="Source labels matter">
            <p>
              Live inference can analyze simulated financial records. A live
              model call does not make fixture financial data live.
            </p>
          </Card>
          <Card title="Your control">
            <p>
              Cancel stops new calls. A message never accepts a plan, transfers
              money or cancels a service.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}
export function Chat() {
  const router = useRouter(),
    action = useAction();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(
      [],
    ),
    [message, setMessage] = useState(""),
    [conversation, setConversation] = useState<string>();
  const suggestions = [
    "What goes into a cash buffer?",
    "How should I compare loan payments?",
    "What makes a savings goal feasible?",
  ];
  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    void action.run(async () => {
      const result = await api<{ conversation_id: string; reply: string }>(
        "chat",
        "POST",
        {
          message: text,
          ...(conversation ? { conversation_id: conversation } : {}),
        },
      );
      setConversation(result.conversation_id);
      setMessages((rows) => [
        ...rows,
        { role: "user", content: text },
        { role: "assistant", content: result.reply },
      ]);
      setMessage("");
    });
  };
  return (
    <div className="content-grid">
      <div className="content-column">
        <Card title="Your conversation" className="conversation-card">
          <div className="conversation" aria-live="polite">
            {messages.length ? (
              messages.map((m, i) => (
                <div key={i} className={`message ${m.role}`}>
                  <span className="message-label">
                    {m.role === "user" ? "You" : "FinPilot"}
                  </span>
                  <p>{m.content}</p>
                </div>
              ))
            ) : (
              <div className="chat-empty">
                <span className="empty-icon">
                  <Icon name="spark" size={28} />
                </span>
                <h2>Clarity starts with a question.</h2>
                <p>
                  Explore a concept, clarify a goal, or request a financial
                  checkup.
                </p>
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => setMessage(s)}>
                      {s}
                      <Icon name="arrow" size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {action.busy && <p className="muted">Waiting for Nemotron…</p>}
          </div>
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <form onSubmit={send} className="chat-compose">
            <label htmlFor="chat-message">Ask FinPilot</label>
            <textarea
              id="chat-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about your next move…"
              maxLength={4000}
              required
              rows={3}
              disabled={action.busy}
            />
            <div className="split">
              <span className="small muted">
                Don’t include passwords, codes or other secrets.
              </span>
              <button
                className="button compact"
                disabled={action.busy || !message.trim()}
              >
                Send <Icon name="arrow" size={16} />
              </button>
            </div>
          </form>
        </Card>
      </div>
      <aside className="inspector">
        <Card title="Basic chat scope">
          <p>
            This chat can explain financial concepts. It does not have
            account-reading tools in the current adapter.
          </p>
          <button
            className="button secondary full"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                const r = await api<{ run_id: string }>("runs", "POST", {
                  intent: "checkup",
                  idempotency_key: action.key({ intent: "checkup" }),
                });
                router.push("/agents?run=" + r.run_id);
              })
            }
          >
            Request a checkup
            <Icon name="spark" size={15} />
          </button>
        </Card>
        <Card title="No action without you">
          <p>
            A conversation cannot authorize money movement or replace explicit
            plan acceptance.
          </p>
        </Card>
      </aside>
    </div>
  );
}
