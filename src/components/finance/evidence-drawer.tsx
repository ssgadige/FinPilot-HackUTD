"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  financeApi,
  FinanceError,
  financeMessage,
  usd,
  type Account,
  type Transaction,
} from "@/lib/finance-api";
import { useFinanceScope, useFinancialRead } from "./finance-scope";
import { Metadata } from "./finance-ui";

export type EvidenceRecord = { account: Account; transaction?: Transaction };
export function EvidenceDrawer({
  record,
  onClose,
}: {
  record: EvidenceRecord;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { accounts } = useFinanceScope();
  const result = useFinancialRead(
    `evidence:${record.account.id}:${record.transaction?.id ?? "account"}`,
    async (signal) => {
      const fresh = await financeApi.accounts(signal);
      if (!fresh.items.some((a) => a.id === record.account.id))
        throw new FinanceError("revoked");
      return fresh;
    },
  );
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  const account = result.data?.items.find((a) => a.id === record.account.id);
  return (
    <dialog
      ref={dialog}
      className="evidence-drawer"
      aria-labelledby="evidence-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
          ),
        ).filter((node) => !node.hidden);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="finance-toolbar">
        <div>
          <p className="eyebrow">Source record</p>
          <h2 id="evidence-title">
            {record.transaction ? "Transaction evidence" : "Account evidence"}
          </h2>
        </div>
        <Button onClick={onClose} autoFocus>
          Close evidence
        </Button>
      </header>
      <p>
        Read-only records from your authorized account scope. Access is checked
        again when you open this drawer.
      </p>
      {!result.data && !result.error ? (
        <DataState state="loading" title="Checking evidence access" />
      ) : result.error ? (
        <DataState
          state="error"
          title="Evidence unavailable"
          action={<Button onClick={result.retry}>Retry evidence</Button>}
        >
          {financeMessage(result.error)}
        </DataState>
      ) : account ? (
        <>
          <dl className="evidence-values">
            <dt>Account</dt>
            <dd>
              {account.label}
              {account.last_four
                ? ` · •••• ${account.last_four}`
                : " · Last four unavailable"}
            </dd>
            <dt>Account kind</dt>
            <dd>{account.kind.replaceAll("_", " ")}</dd>
            {record.transaction ? (
              <>
                <dt>Description</dt>
                <dd>{record.transaction.description}</dd>
                <dt>Date</dt>
                <dd>{record.transaction.date}</dd>
                <dt>Signed balance change</dt>
                <dd>{usd(record.transaction.amount_cents)}</dd>
                <dt>Type / status</dt>
                <dd>
                  {record.transaction.classification ?? "Unclassified"} /{" "}
                  {record.transaction.status ?? "Unreported"}
                </dd>
              </>
            ) : (
              <>
                <dt>Balance</dt>
                <dd>{usd(account.balance_cents)}</dd>
                <dt>Last successful sync</dt>
                <dd>{account.last_sync_at ?? "Unavailable"}</dd>
              </>
            )}
          </dl>
          <Metadata meta={accounts} />
        </>
      ) : (
        <DataState state="error" title="Evidence no longer accessible">
          This account was disconnected or access was revoked.
        </DataState>
      )}
    </dialog>
  );
}
