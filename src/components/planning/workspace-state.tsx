"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFinanceScope } from "@/components/finance/finance-scope";
import { FinanceError } from "@/lib/finance-api";
import { WorkspaceProblem, workspaceMessage } from "@/lib/workspace-api";
import { DataState } from "@/components/ui/data-state";
import { Button } from "@/components/ui/button";

export function useWorkspaceRead<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const { epoch, currentEpoch, fail } = useFinanceScope();
  const [retry, setRetry] = useState(0);
  const requestKey = epoch + ":" + key + ":" + retry;
  const [result, setResult] = useState<{
    key: string;
    data?: T;
    error?: unknown;
  }>();
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  }, [load]);
  useEffect(() => {
    const c = new AbortController();
    void loader
      .current(c.signal)
      .then((data) => {
        if (!c.signal.aborted && currentEpoch() === epoch)
          setResult({ key: requestKey, data });
      })
      .catch((error) => {
        if (c.signal.aborted || currentEpoch() !== epoch) return;
        if (
          error instanceof WorkspaceProblem &&
          (error.status === 401 || error.status === 403)
        )
          fail(new FinanceError(error.status === 401 ? "auth" : "revoked"));
        setResult({ key: requestKey, error });
      });
    return () => c.abort();
  }, [requestKey, epoch, currentEpoch, fail]);
  return {
    data: result?.key === requestKey ? result.data : undefined,
    error: result?.key === requestKey ? result.error : undefined,
    retry: () => setRetry((v) => v + 1),
  };
}
export function useWorkspaceAction() {
  const { state } = useAuth();
  const { epoch, currentEpoch, fail, accounts } = useFinanceScope();
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const csrf =
    state.status === "authenticated" ? state.session.csrfToken : null;
  async function run<T>(
    work: (signal: AbortSignal, csrf: string | null) => Promise<T>,
    success: (data: T) => void,
    onFailure?: (error: unknown) => void,
  ) {
    if (controller.current) return;
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError(null);
    try {
      const value = await work(c.signal, csrf);
      if (
        value &&
        typeof value === "object" &&
        "snapshot_version" in value &&
        value.snapshot_version !== accounts.snapshot_version
      ) {
        if (!c.signal.aborted && currentEpoch() === epoch)
          fail(new FinanceError("snapshot"));
        return;
      }
      if (!c.signal.aborted && currentEpoch() === epoch) success(value);
    } catch (e) {
      if (c.signal.aborted || currentEpoch() !== epoch) return;
      if (
        e instanceof WorkspaceProblem &&
        (e.status === 401 || e.status === 403)
      )
        fail(new FinanceError(e.status === 401 ? "auth" : "revoked"));
      else {
        setError(workspaceMessage(e));
        onFailure?.(e);
      }
    } finally {
      if (!c.signal.aborted && currentEpoch() === epoch) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  return { busy, error, run };
}
export function ResourceState({
  error,
  retry,
}: {
  error?: unknown;
  retry: () => void;
}) {
  return (
    <DataState
      state={error ? "error" : "loading"}
      title={error ? "This section is unavailable" : "Loading your records"}
      action={
        error ? <Button onClick={retry}>Retry section</Button> : undefined
      }
    >
      {error ? workspaceMessage(error) : "Checking the latest authorized data."}
    </DataState>
  );
}
