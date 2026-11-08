"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Workflow, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { FinanceScope } from "@/components/finance/finance-scope";
import { AgentsScreen, type FindingContext } from "@/components/planning/agents";
import { PageHeading } from "@/components/page-heading";
import { CoachPanel, type CoachDraft } from "./coach-panel";
import "./chat.css";

/** One workspace; selected evidence is a draft, never an implicit model request. */
export function AgentWorkspace() {
  const { state } = useAuth();
  if (state.status !== "authenticated") return null;
  return <PrivateWorkspace key={state.session.profile.id} />;
}

function PrivateWorkspace() {
  const [view, setView] = useState<"team" | "coach">("team");
  const [runId, setRunId] = useState<string>();
  const [draft, setDraft] = useState<CoachDraft>();
  const sequence = useRef(0);
  const coachButton = useRef<HTMLButtonElement>(null);
  const teamButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const update = () => { if (location.hash === "#coach") setView("coach"); };
    update(); window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const explain = useCallback((context: FindingContext) => {
    const evidence = context.evidenceIds[0];
    if (!evidence) return;
    setDraft({ id: ++sequence.current, text: `Explain the current finding supported by evidence ${evidence}.` });
    setView("coach");
    coachButton.current?.focus();
  }, []);
  const inspect = useCallback((id: string) => {
    setRunId(id); setView("team"); teamButton.current?.focus();
  }, []);
  return <div className="page-stack agent-command-center">
    <div className="agent-workspace-switcher" role="group" aria-label="Workspace view">
      <button ref={teamButton} type="button" className={`button button--${view === "team" ? "primary" : "ghost"}`} aria-pressed={view === "team"} aria-controls="specialist-view" onClick={() => setView("team")}><Workflow size={18} aria-hidden="true" />Specialist team</button>
      <button ref={coachButton} type="button" className={`button button--${view === "coach" ? "primary" : "ghost"}`} aria-pressed={view === "coach"} aria-controls="coach-view" onClick={() => setView("coach")}><MessagesSquare size={18} aria-hidden="true" />Ask FinPilot</button>
      <span className="agent-readonly"><ShieldCheck size={16} aria-hidden="true" />Analysis and planning only</span>
    </div>
    <section id="specialist-view" hidden={view !== "team"} aria-label="Specialist team">
      <FinanceScope allowEmpty><AgentsScreen key={runId ?? "new"} initialRunId={runId} onExplain={explain} /></FinanceScope>
    </section>
    <section id="coach-view" hidden={view !== "coach"} aria-label="Financial coach">
      <PageHeading title="Ask about your next move" description="One conversation. Current financial evidence. Decisions stay with you." />
      <CoachPanel draft={draft} onInspectRun={inspect} />
    </section>
  </div>;
}
