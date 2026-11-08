"use client";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, SelectField } from "@/components/ui/form-field";
import { DataTable } from "@/components/ui/data-table";
import {
  emptyFilters,
  financeApi,
  FinanceError,
  usd,
  type Filters,
} from "@/lib/finance-api";
import { useFinanceScope, useFinancialRead } from "./finance-scope";
import { EvidenceDrawer, type EvidenceRecord } from "./evidence-drawer";
import { Metadata, ReadState } from "./finance-ui";

export function TransactionsScreen({
  initialAccount = "",
}: {
  initialAccount?: string;
}) {
  const { accounts } = useFinanceScope();
  const [query, setQuery] = useState<{
    filters: Filters;
    cursors: (string | null)[];
  }>({
    filters: { ...emptyFilters, account_id: initialAccount },
    cursors: [null],
  });
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const { filters, cursors } = query;
  const invalidDates = !!(
    filters.from &&
    filters.to &&
    filters.from > filters.to
  );
  const result = useFinancialRead(
    `transactions:${JSON.stringify(query)}`,
    async (signal) => {
      if (invalidDates) throw new FinanceError("filters");
      if (
        filters.account_id &&
        !accounts.items.some((a) => a.id === filters.account_id)
      )
        throw new FinanceError("revoked");
      const data = await financeApi.transactions(
        filters,
        cursors.at(-1) ?? null,
        signal,
      );
      if (
        data.items.some(
          (t) => !accounts.items.some((a) => a.id === t.account_id),
        )
      )
        throw new FinanceError("revoked");
      return data;
    },
  );
  function change(key: keyof Filters, value: string) {
    setEvidence(null);
    setQuery((q) => ({
      filters: { ...q.filters, [key]: value },
      cursors: [null],
    }));
  }
  const filtered = Object.values(filters).some(Boolean);
  return (
    <div className="page-stack finance-page">
      <PageHeading
        title="Every transaction, in its place"
        description="Search all available history. No default start date excludes older records."
      />
      <div className="finance-columns">
        <Card>
          <h2>Search and filters</h2>
          <div className="finance-filters">
            <FormField
              label="Search transactions"
              placeholder="Merchant or description"
              value={filters.q}
              onChange={(e) => change("q", e.target.value)}
            />
            <SelectField
              label="Account"
              value={filters.account_id}
              onChange={(e) => change("account_id", e.target.value)}
            >
              <option value="">All linked accounts</option>
              {accounts.items.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.label}
                </option>
              ))}
            </SelectField>
            <FormField
              label="Category"
              placeholder="All categories"
              value={filters.category}
              onChange={(e) => change("category", e.target.value)}
            />
            <FormField
              type="date"
              label="From date"
              value={filters.from}
              onChange={(e) => change("from", e.target.value)}
            />
            <FormField
              type="date"
              label="To date"
              value={filters.to}
              onChange={(e) => change("to", e.target.value)}
              error={
                invalidDates
                  ? "End date must be on or after start date."
                  : undefined
              }
            />
          </div>
          <Button
            variant="secondary"
            disabled={!filtered}
            onClick={() => {
              setEvidence(null);
              setQuery({ filters: { ...emptyFilters }, cursors: [null] });
            }}
          >
            Clear filters
          </Button>
        </Card>
        <Card>
          <h2>History with context</h2>
          <p>
            Available history may span 30 months or a shorter period. Missing
            months are never filled in.
          </p>
          <p>
            Charges increase card debt; payments reduce it. On asset accounts,
            positive changes increase balance and negative changes reduce it.
            Types and pending status are supplied by the backend.
          </p>
          <p>
            Transfers remain in history. Income, spending and debt summaries
            come from backend tools; this page does not add up transaction rows.
          </p>
          <Link href="/overview">View backend summary totals</Link>
        </Card>
      </div>
      <Card>
        <h2>Transaction history</h2>
        {result.data ? (
          <>
            <Metadata meta={result.data} />
            <DataTable
              caption="Transaction history"
              rows={result.data.items}
              rowKey={(r) => r.id}
              emptyMessage={
                filtered
                  ? "No transactions match these filters."
                  : "Connected accounts have no transaction records yet."
              }
              columns={[
                {
                  key: "date",
                  label: "Date",
                  render: (r) => <time dateTime={r.date}>{r.date}</time>,
                },
                {
                  key: "description",
                  label: "Description",
                  render: (r) => r.description,
                },
                {
                  key: "account",
                  label: "Account / kind",
                  render: (r) => {
                    const a = accounts.items.find(
                      (a) => a.id === r.account_id,
                    )!;
                    return (
                      <>
                        {a.label}
                        <small className="table-detail">
                          {a.kind.replaceAll("_", " ")}
                        </small>
                      </>
                    );
                  },
                },
                {
                  key: "category",
                  label: "Category",
                  render: (r) => r.category ?? "Unreported",
                },
                {
                  key: "type",
                  label: "Type / status",
                  render: (r) => (
                    <>
                      {r.classification ?? "Unclassified"}
                      <small className="table-detail">
                        {r.status ?? "Status unreported"}
                      </small>
                    </>
                  ),
                },
                {
                  key: "amount",
                  label: "Signed balance change (USD)",
                  numeric: true,
                  render: (r) => usd(r.amount_cents),
                },
                {
                  key: "evidence",
                  label: "Evidence",
                  render: (r) => (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEvidence({
                          account: accounts.items.find(
                            (a) => a.id === r.account_id,
                          )!,
                          transaction: r,
                        })
                      }
                    >
                      Inspect {r.description}
                    </Button>
                  ),
                },
              ]}
            />
            <nav
              className="finance-toolbar"
              aria-label="Transaction pagination"
            >
              <Button
                variant="secondary"
                disabled={cursors.length === 1}
                onClick={() => {
                  setEvidence(null);
                  setQuery((q) => ({ ...q, cursors: q.cursors.slice(0, -1) }));
                }}
              >
                Previous page
              </Button>
              <span aria-live="polite">Page {cursors.length}</span>
              <Button
                variant="secondary"
                disabled={
                  !result.data.next_cursor ||
                  cursors.includes(result.data.next_cursor)
                }
                onClick={() => {
                  const next = result.data?.next_cursor;
                  if (next) {
                    setEvidence(null);
                    setQuery((q) => ({ ...q, cursors: [...q.cursors, next] }));
                  }
                }}
              >
                Next page
              </Button>
            </nav>
          </>
        ) : (
          <ReadState {...result} />
        )}
      </Card>
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
