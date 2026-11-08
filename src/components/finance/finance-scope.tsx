"use client";
import Link from "next/link";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { DataState } from "@/components/ui/data-state";
import {
  financeApi,
  FinanceError,
  financeMessage,
  type Accounts,
  type Meta,
} from "@/lib/finance-api";
import "./finance.css";

type Scope = {
  accounts: Accounts;
  epoch: number;
  currentEpoch: () => number;
  refresh: () => void;
  fail: (error: unknown) => void;
};
const Context = createContext<Scope | null>(null);
export function FinanceScope({
  children,
  allowEmpty = false,
}: {
  children: ReactNode;
  allowEmpty?: boolean;
}) {
  const { state: auth, clearSession } = useAuth();
  const identity =
    auth.status === "authenticated" ? auth.session.profile.id : null;
  const [version, setVersion] = useState(0);
  const epoch = useRef(0);
  const currentEpoch = useCallback(() => epoch.current, []);
  const [result, setResult] = useState<{
    identity: string;
    epoch: number;
    data?: Accounts;
    error?: unknown;
  } | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const refresh = useCallback(() => {
    epoch.current++;
    setBlocked(null);
    setResult(null);
    setVersion(epoch.current);
  }, []);
  const fail = useCallback(
    (error: unknown) => {
      if (
        !(error instanceof FinanceError) ||
        !["auth", "revoked", "snapshot"].includes(error.kind)
      )
        return;
      epoch.current++;
      setResult(null);
      setBlocked(financeMessage(error));
      if (error.kind === "auth") clearSession();
    },
    [clearSession],
  );
  useEffect(() => {
    window.addEventListener("finpilot:finance-invalidated", refresh);
    return () =>
      window.removeEventListener("finpilot:finance-invalidated", refresh);
  }, [refresh]);
  useEffect(() => {
    if (!identity || blocked) return;
    const controller = new AbortController();
    const generation = epoch.current;
    void financeApi
      .accounts(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && generation === epoch.current)
          setResult({ identity, epoch: generation, data });
      })
      .catch((error) => {
        if (controller.signal.aborted || generation !== epoch.current) return;
        fail(error);
        setResult({ identity, epoch: generation, error });
      });
    return () => controller.abort();
  }, [identity, version, blocked, fail]);
  if (!identity)
    return (
      <DataState
        headingLevel={1}
        state="error"
        title="Financial access requires a verified session"
        action={<Link href="/login">Return to login</Link>}
      >
        No financial records are displayed.
      </DataState>
    );
  if (blocked)
    return (
      <DataState
        headingLevel={1}
        state="error"
        title="Financial access changed"
        action={<Button onClick={refresh}>Refresh financial data</Button>}
      >
        {blocked}
      </DataState>
    );
  if (!result || result.identity !== identity || result.epoch !== version)
    return (
      <DataState
        headingLevel={1}
        state="loading"
        title="Checking authorized accounts"
      >
        Financial records stay hidden until account scope is confirmed.
      </DataState>
    );
  if (!result.data)
    return (
      <DataState
        headingLevel={1}
        state="error"
        title="Accounts unavailable"
        action={<Button onClick={refresh}>Retry accounts</Button>}
      >
        {financeMessage(result.error)}
      </DataState>
    );
  if (!result.data.items.length && !allowEmpty)
    return (
      <DataState headingLevel={1} state="empty" title="No connected accounts">
        <p>
          Connect a simulated institution to see your financial picture.
          Disconnected records are no longer available.
        </p>
        <Link href="/institutions">Go to Institutions</Link>
      </DataState>
    );
  return (
    <Context.Provider
      value={{
        accounts: result.data,
        epoch: result.epoch,
        currentEpoch,
        refresh,
        fail,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useFinanceScope() {
  const value = useContext(Context);
  if (!value) throw new Error("FinanceScope is required");
  return value;
}
/** Abort plus generation and request-key checks: even a transport ignoring abort cannot restore stale data. */
export function useFinancialRead<T extends Meta>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const { accounts, epoch, currentEpoch, fail } = useFinanceScope();
  const [retry, setRetry] = useState(0);
  const requestKey = `${epoch}:${key}:${retry}`;
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: unknown;
  } | null>(null);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    void loader
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted || currentEpoch() !== epoch) return;
        if (data.snapshot_version !== accounts.snapshot_version)
          throw new FinanceError("snapshot");
        setResult({ key: requestKey, data });
      })
      .catch((error) => {
        if (controller.signal.aborted || currentEpoch() !== epoch) return;
        fail(error);
        setResult({ key: requestKey, error });
      });
    return () => controller.abort();
  }, [requestKey, accounts.snapshot_version, epoch, currentEpoch, fail]);
  return {
    data: result?.key === requestKey ? result.data : undefined,
    error: result?.key === requestKey ? result.error : undefined,
    retry: () => setRetry((v) => v + 1),
  };
}
