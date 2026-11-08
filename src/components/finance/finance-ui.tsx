import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";
import { DataTable } from "@/components/ui/data-table";
import {
  financeMessage,
  usd,
  type Commitment,
  type Meta,
} from "@/lib/finance-api";
import { useFinanceScope } from "./finance-scope";
import type { EvidenceRecord } from "./evidence-drawer";

export function Metadata({ meta }: { meta: Meta }) {
  return (
    <details className="finance-metadata compact-metadata">
      <summary>As of {meta.as_of??"date unavailable"} | {meta.source_mode==="fixture"?"Demo records":meta.source_mode==="cached"?"Saved snapshot":"Source details"}</summary>
      <p>Snapshot {meta.snapshot_version}</p>
      {meta.assumptions?.length?<p>{meta.assumptions.join("; ")}</p>:null}
      {meta.missing_inputs?.length?<p>Missing inputs: {meta.missing_inputs.join("; ")}</p>:null}
    </details>
  );
}
export function ReadState({
  error,
  retry,
}: {
  error?: unknown;
  retry: () => void;
}) {
  return (
    <DataState
      state={error ? "error" : "loading"}
      title={error ? "Financial data unavailable" : "Loading financial records"}
      action={error ? <Button onClick={retry}>Retry</Button> : undefined}
    >
      {error
        ? financeMessage(error)
        : "Fetching this section from the financial service."}
    </DataState>
  );
}
export function Commitments({
  items,
  title,
  onEvidence,
}: {
  items: Commitment[] | undefined;
  title: string;
  onEvidence: (record: EvidenceRecord) => void;
}) {
  const { accounts } = useFinanceScope();
  return (
    <Card>
      <h2>{title}</h2>
      <p className="muted">
        Projected commitments, not posted transactions. Dates and cash effects
        are supplied by the service.
      </p>
      {items ? (
        <DataTable
          caption={title}
          rows={items}
          rowKey={(r) => r.id}
          emptyMessage="No upcoming commitments were returned."
          columns={[
            {
              key: "date",
              label: "Projected date",
              render: (r) => <time dateTime={r.date}>{r.date}</time>,
            },
            { key: "event", label: "Commitment", render: (r) => r.description },
            {
              key: "amount",
              label: "Amount",
              numeric: true,
              render: (r) => usd(r.amount_cents),
            },
            {
              key: "evidence",
              label: "Source",
              render: (r) => {
                const account = accounts.items.find(
                  (a) => a.id === r.account_id,
                );
                return account ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => onEvidence({ account })}
                    >
                      Inspect {account.label}
                    </Button>
                    {r.transaction_id && (
                      <Link
                        href={`/transactions?account_id=${encodeURIComponent(r.account_id)}`}
                      >
                        Related transaction history
                      </Link>
                    )}
                  </>
                ) : (
                  "Account evidence unavailable"
                );
              },
            },
          ]}
        />
      ) : (
        <DataState state="empty" title="Upcoming commitments unavailable">
          The service did not supply these records.
        </DataState>
      )}
    </Card>
  );
}
