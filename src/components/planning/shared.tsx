"use client";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { useFinanceScope } from "@/components/finance/finance-scope";
import { Metadata } from "@/components/finance/finance-ui";
import { workspaceApi } from "@/lib/workspace-api";
import { ReviewDialog } from "./modal";
import { ResourceState, useWorkspaceRead } from "./workspace-state";
import "./planning.css";
export function Sources() {
  const { accounts } = useFinanceScope();
  return <Metadata meta={accounts} />;
}
export function Unlinked() {
  return (
    <DataState state="empty" title="No connected accounts">
      <p>
        Connect a simulated institution and complete verification and consent
        before reviewing account-backed records.
      </p>
      <Link href="/institutions">Go to Institutions</Link>
    </DataState>
  );
}
export function EvidenceLinks({ ids }: { ids: string[] }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <>
      <div className="finance-actions">
        {ids.map((id) => (
          <Button variant="ghost" key={id} onClick={() => setId(id)}>
            Inspect evidence {id.slice(0, 12)}
          </Button>
        ))}
      </div>
      {id && <EvidenceReference id={id} onClose={() => setId(null)} />}
    </>
  );
}
function EvidenceReference({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const r = useWorkspaceRead("evidence:" + id, (s) =>
    workspaceApi.evidence(id, s),
  );
  return (
    <ReviewDialog title="Supporting evidence" onClose={onClose}>
      {r.data ? (
        <dl className="evidence-values">
          <dt>Type</dt>
          <dd>{r.data.kind}</dd>
          <dt>Source</dt>
          <dd>{r.data.source_mode}</dd>
          <dt>Observed</dt>
          <dd>{r.data.observed_at}</dd>
          <dt>Source record</dt>
          <dd>{r.data.source_id}</dd>
        </dl>
      ) : (
        <ResourceState {...r} />
      )}
      <p>
        Read-only evidence. Revoked, disconnected or changed snapshots are
        unavailable.
      </p>
    </ReviewDialog>
  );
}
export function SafetyNote() {
  return (
    <Card>
      <h2>Your decision, with clear limits</h2>
      <p>
        Saving a goal, preference, intention or plan does not move money, change
        a merchant subscription or apply for credit. Proposed savings are not
        confirmed funds.
      </p>
    </Card>
  );
}
