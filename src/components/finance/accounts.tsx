"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usd } from "@/lib/finance-api";
import { useFinanceScope } from "./finance-scope";
import { EvidenceDrawer, type EvidenceRecord } from "./evidence-drawer";
import { Metadata } from "./finance-ui";
export function AccountsScreen() {
  const { accounts, refresh } = useFinanceScope();
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  return (
    <div className="page-stack finance-page">
      <PageHeading
        title="Accounts with context"
        description="Separate available cash, liabilities and restricted assets."
        action={
          <Button variant="secondary" onClick={refresh}>
            Refresh financial data
          </Button>
        }
      />
      <Metadata meta={accounts} />
      <div className="finance-signals">
        {accounts.items.map((a) => (
          <Card key={a.id}>
            <h2>{a.label}</h2>
            <p>
              {a.kind.replaceAll("_", " ")}
              {a.last_four ? ` · •••• ${a.last_four}` : ""}
            </p>
            <p className="signal-value">{usd(a.balance_cents)}</p>
            <p>Last successful sync: {a.last_sync_at ?? "Unavailable"}</p>
            <Button
              variant="secondary"
              onClick={() => setEvidence({ account: a })}
            >
              Inspect {a.label}
            </Button>
            <p>
              <Link
                href={`/transactions?account_id=${encodeURIComponent(a.id)}`}
              >
                View account history
              </Link>
            </p>
          </Card>
        ))}
      </div>
      <Card>
        <h2>Available cash policy</h2>
        <p>
          Investments, retirement and CD balances are excluded from spendable
          cash by default. Card and loan balances represent amounts owed.
          Overview totals are calculated by the backend.
        </p>
        <Link href="/institutions">Manage institution connections</Link>
      </Card>
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
