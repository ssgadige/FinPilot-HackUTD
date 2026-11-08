"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  connectionsApi,
  connectionProblem,
  type ConnectionProblem,
} from "@/lib/connections-api";
import type { ConfirmedConnection, VerifiedInstitutionPreview } from "./types";
import { ConnectionFeedback, useConnectionClock } from "./connection-feedback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import { ConnectionManager } from "./connection-manager";
import "./connections.css";

/** Prepared post-OTP component. The catalog cannot reach this until FP-11 is integrated. */
type ConsentProps = {
  preview: VerifiedInstitutionPreview;
  csrfToken: string | null;
  onStartAgain: () => void;
};
export function AccountConsent(props: ConsentProps) {
  return (
    <ConsentIntent
      key={`${props.preview.institutionId}:${props.preview.previewToken}`}
      {...props}
    />
  );
}
function ConsentIntent({ preview, csrfToken, onStartAgain }: ConsentProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [problem, setProblem] = useState<ConnectionProblem | null>(null);
  const [connection, setConnection] = useState<ConfirmedConnection | null>(
    null,
  );
  const [retryAt, setRetryAt] = useState(0);
  const now = useConnectionClock();
  const operation = useRef<{ key: string; ids: string[] } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const expired =
    !Number.isFinite(Date.parse(preview.expiresAt)) ||
    Date.parse(preview.expiresAt) <= now ||
    problem?.kind === "expired-preview";
  const scopeReady = Boolean(
    preview.previewToken &&
    preview.consentVersion &&
    preview.accounts.length &&
    preview.accounts.every(
      (account) =>
        account.id &&
        account.label &&
        /^\d{4}$/.test(account.lastFour) &&
        account.records.length > 0,
    ) &&
    new Set(preview.accounts.map((account) => account.id)).size ===
      preview.accounts.length,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      controller.current ||
      !consent ||
      !selected.length ||
      expired ||
      !scopeReady ||
      now < retryAt
    )
      return;
    // Freeze this intent after submission. A retry reuses both scope and key.
    operation.current ??= {
      key: crypto.randomUUID(),
      ids: [...selected].sort(),
    };
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setAttempted(true);
    setProblem(null);
    try {
      const receipt = await connectionsApi.link(
        {
          previewToken: preview.previewToken,
          institutionId: preview.institutionId,
          accountIds: operation.current.ids,
          consentVersion: preview.consentVersion,
          idempotencyKey: operation.current.key,
        },
        { csrfToken, signal: request.signal },
      );
      if (request.signal.aborted) return;
      setConnection({
        id: receipt.connectionId,
        institutionId: receipt.institutionId,
        institutionName: preview.institutionName,
        status: "active",
        lastSuccessfulSync: receipt.lastSuccessfulSync,
        accounts: preview.accounts
          .filter((account) => receipt.accountIds.includes(account.id))
          .map(({ id, label, lastFour }) => ({ id, label, lastFour })),
      });
    } catch (error) {
      if (request.signal.aborted) return;
      const failure = connectionProblem(error);
      setProblem(failure);
      if (failure.kind === "rate-limit")
        setRetryAt(Date.now() + failure.retryAfter * 1000);
    } finally {
      if (!request.signal.aborted) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  if (connection)
    return (
      <ConnectionManager
        connection={connection}
        csrfToken={csrfToken}
        onReconnect={onStartAgain}
      />
    );
  return (
    <div className="page-stack">
      <p className="simulation-warning">
        Simulation only. Do not enter real banking credentials.
      </p>
      <div className="decision-grid">
        <Card>
          <h2>Choose the accounts to connect</h2>
          <p className="muted">
            {preview.institutionName} · read-only access, controlled by you.
          </p>
          <form onSubmit={submit} className="page-stack" aria-busy={busy}>
            <fieldset
              disabled={busy || attempted || expired || !scopeReady}
              className="account-choices"
            >
              <legend>Accounts and exact record scope</legend>
              {preview.accounts.map((account) => (
                <label className="account-choice" key={account.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(account.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, account.id]
                          : current.filter((id) => id !== account.id),
                      )
                    }
                  />
                  <span>
                    <strong>
                      {account.label} · •••• {account.lastFour}
                    </strong>
                    <ul>
                      {account.records.map((record) => (
                        <li key={record}>{record}</li>
                      ))}
                    </ul>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="consent-choice">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy || attempted || expired || !scopeReady}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                I authorize read-only access to the selected accounts and only
                the records listed above.
              </span>
            </label>
            {attempted && !busy && !expired && (
              <p className="small muted">
                This request’s result is unconfirmed. Retry the same selected
                scope; the operation key is preserved.
              </p>
            )}
            {expired && (
              <DataState state="stale" title="Preview expired">
                Start institution login and verification again.
              </DataState>
            )}
            {!scopeReady && (
              <DataState state="empty" title="Account scope unavailable">
                A verified preview with exact record scope and consent version
                is required.
              </DataState>
            )}
            <ConnectionFeedback problem={problem} />
            {retryAt > now && (
              <p role="timer" aria-live="off">
                Try again in {Math.ceil((retryAt - now) / 1000)} seconds.
              </p>
            )}
            <Button
              type="submit"
              disabled={
                busy ||
                !consent ||
                !selected.length ||
                expired ||
                !scopeReady ||
                now < retryAt
              }
            >
              {busy
                ? "Connecting selected accounts…"
                : attempted
                  ? "Retry same link request"
                  : "Connect selected accounts"}
            </Button>
            <p role="status" className="small muted">
              {busy
                ? "Waiting for backend confirmation. No connection is claimed yet."
                : "Nothing is selected or consented by default."}
            </p>
            {(!attempted || expired) && (
              <Button
                variant="secondary"
                onClick={onStartAgain}
                disabled={busy}
              >
                Start institution sign-in again
              </Button>
            )}
          </form>
        </Card>
        <div className="page-stack">
          <Card>
            <h2>Only your selected scope</h2>
            {selected.length ? (
              <ul>
                {preview.accounts
                  .filter((account) => selected.includes(account.id))
                  .map((account) => (
                    <li key={account.id}>
                      {account.label} · •••• {account.lastFour}
                      <ul>
                        {account.records.map((record) => (
                          <li key={record}>{record}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="muted">
                Select an account to review its exact access.
              </p>
            )}
          </Card>
          <Card>
            <h2>No money movement</h2>
            <p className="muted">
              Connecting does not authorize payments, transfers, cancellations
              or purchases.
            </p>
          </Card>
          <Card>
            <h2>Disconnect means inaccessible</h2>
            <p className="muted">
              Disconnecting revokes this access. Dependent records and findings
              must be refreshed.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
