"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  connectionsApi,
  connectionProblem,
  type ConnectionProblem,
} from "@/lib/connections-api";
import type { ConfirmedConnection } from "./types";
import { ConnectionFeedback, useConnectionClock } from "./connection-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";
import { DataTable } from "@/components/ui/data-table";
import "./connections.css";

/** Receives only a confirmed server view model; no status-listing endpoint is assumed. */
export function ConnectionManager({
  connection,
  csrfToken,
  onReconnect,
}: {
  connection: ConfirmedConnection;
  csrfToken: string | null;
  onReconnect: () => void;
}) {
  const router = useRouter();
  const [disconnected, setDisconnected] = useState(
    connection.status === "revoked",
  );
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [problem, setProblem] = useState<ConnectionProblem | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [snapshot, setSnapshot] = useState<number | null>(null);
  const [syncRetry, setSyncRetry] = useState(false);
  const [accounts, setAccounts] = useState(connection.accounts);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const now = useConnectionClock();
  const controller = useRef<AbortController | null>(null);
  const syncKey = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const disconnectButton = useRef<HTMLButtonElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
  }, [confirming]);

  async function sync() {
    if (controller.current || disconnected || now < retryAt) return;
    syncKey.current ??= crypto.randomUUID();
    const request = new AbortController();
    controller.current = request;
    setBusy("sync");
    setProblem(null);
    setSnapshot(null);
    try {
      const version = await connectionsApi.sync(
        connection.id,
        syncKey.current,
        { csrfToken, signal: request.signal },
      );
      if (!request.signal.aborted) {
        setSnapshot(version);
        setSyncRetry(false);
        syncKey.current = null;
        router.refresh();
      }
    } catch (error) {
      if (request.signal.aborted) return;
      const failure = connectionProblem(error);
      setProblem(failure);
      setSyncRetry(true);
      if (failure.kind === "rate-limit")
        setRetryAt(Date.now() + failure.retryAfter * 1000);
    } finally {
      if (!request.signal.aborted) {
        controller.current = null;
        setBusy(null);
      }
    }
  }
  function closeConfirmation() {
    if (controller.current) return;
    dialog.current?.close();
    setConfirming(false);
    setConfirmed(false);
    disconnectButton.current?.focus();
  }
  async function disconnect() {
    if (controller.current || !confirmed || now < retryAt) return;
    const request = new AbortController();
    controller.current = request;
    setBusy("disconnect");
    setProblem(null);
    try {
      await connectionsApi.disconnect(connection.id, {
        csrfToken,
        signal: request.signal,
      });
      if (request.signal.aborted) return;
      // Invalidate BEFORE any refresh. Do not re-display revoked records on refresh failure.
      setDisconnected(true);
      setAccounts([]);
      setSnapshot(null);
      syncKey.current = null;
      setConfirming(false);
      setConfirmed(false);
      dialog.current?.close();
      window.dispatchEvent(new Event("finpilot:finance-invalidated"));
      const results = await Promise.allSettled([
        connectionsApi.accounts({ signal: request.signal }),
        connectionsApi.refreshOverview({ signal: request.signal }),
      ]);
      if (!request.signal.aborted) {
        setRefreshFailed(
          results.some((result) => result.status === "rejected"),
        );
        router.refresh();
      }
    } catch (error) {
      if (request.signal.aborted) return;
      const failure = connectionProblem(error);
      setProblem(failure);
      if (failure.kind === "rate-limit")
        setRetryAt(Date.now() + failure.retryAfter * 1000);
    } finally {
      if (!request.signal.aborted) {
        controller.current = null;
        setBusy(null);
      }
    }
  }
  return (
    <div className="page-stack">
      <Card>
        <div className="card-heading">
          <h2>{connection.institutionName} connection</h2>
          <Badge tone={disconnected ? "neutral" : "success"}>
            {disconnected ? "Disconnected" : "Connected · server confirmed"}
          </Badge>
        </div>
        {disconnected ? (
          <>
            <DataState state="empty" title="Access revoked">
              Previously connected account details have been removed from this
              view.
            </DataState>
            {refreshFailed && (
              <DataState
                state="stale"
                title="Updated financial data unavailable"
              >
                Disconnect was confirmed. Old records remain hidden; accounts
                and overview refresh could not complete.
              </DataState>
            )}
            <Button onClick={onReconnect}>
              Reconnect with institution verification
            </Button>
          </>
        ) : (
          <>
            <p className="muted small">
              Last reported successful sync:{" "}
              {connection.lastSuccessfulSync &&
              Number.isFinite(Date.parse(connection.lastSuccessfulSync))
                ? new Date(connection.lastSuccessfulSync).toLocaleString(
                    "en-US",
                    { timeZone: "UTC", timeZoneName: "short" },
                  )
                : "Not supplied by the server"}
            </p>
            <DataTable
              caption="Backend-confirmed connected account labels"
              columns={[
                {
                  key: "label",
                  label: "Account",
                  render: (account) => account.label,
                },
                {
                  key: "lastFour",
                  label: "Masked identifier",
                  render: (account) => `•••• ${account.lastFour}`,
                },
              ]}
              rows={accounts}
              rowKey={(account) => account.id}
            />
            {busy === "sync" && (
              <DataState state="loading" title="Bringing your records together">
                Sync request in progress. Waiting for backend confirmation; no
                percentage or completion is assumed.
              </DataState>
            )}
            {snapshot !== null && (
              <DataState state="success" title="Sync confirmed">
                Backend snapshot {snapshot}. A newer sync timestamp has not been
                supplied.
              </DataState>
            )}
            <ConnectionFeedback problem={!confirming ? problem : null} />
            {retryAt > now && (
              <p role="timer" aria-live="off">
                Try again in {Math.ceil((retryAt - now) / 1000)} seconds.
              </p>
            )}
            <div className="inline-actions">
              <Button onClick={sync} disabled={Boolean(busy) || now < retryAt}>
                {busy === "sync"
                  ? "Sync request in progress…"
                  : syncRetry
                    ? "Retry same sync request"
                    : "Sync records"}
              </Button>
              <button
                ref={disconnectButton}
                className="button button--secondary"
                onClick={() => {
                  setConfirming(true);
                  setConfirmed(false);
                  setProblem(null);
                }}
                disabled={Boolean(busy)}
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </Card>
      {confirming && (
        <dialog
          ref={dialog}
          className="connection-dialog"
          aria-labelledby="disconnect-title"
          onCancel={(event) => {
            event.preventDefault();
            closeConfirmation();
          }}
        >
          <div className="page-stack">
            <h2 id="disconnect-title">
              Disconnect {connection.institutionName}?
            </h2>
            <p>
              Access to the linked accounts, transaction records and dependent
              findings will be revoked. Existing financial data must be
              refreshed.
            </p>
            <label className="consent-choice">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy === "disconnect"}
              />
              <span>
                I confirm that I want to disconnect {connection.institutionName}
                .
              </span>
            </label>
            <ConnectionFeedback problem={problem} />
            <div className="inline-actions">
              <Button
                onClick={disconnect}
                disabled={!confirmed || busy === "disconnect" || now < retryAt}
              >
                {busy === "disconnect"
                  ? "Revoking access…"
                  : "Confirm disconnect"}
              </Button>
              <Button
                variant="secondary"
                onClick={closeConfirmation}
                disabled={busy === "disconnect"}
              >
                Keep connection
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
