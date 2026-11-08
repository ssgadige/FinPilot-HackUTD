"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectionProblem } from "@/lib/connections-api";
import { DataState } from "@/components/ui/data-state";

export function useConnectionClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return now;
}
export function ConnectionFeedback({
  problem,
}: {
  problem: ConnectionProblem | null;
}) {
  if (!problem) return null;
  return (
    <DataState
      state="error"
      headingLevel={3}
      title={
        problem.kind === "invalid-login"
          ? "Could not validate the demo credentials"
          : problem.kind === "expired-preview"
            ? "Preview expired"
            : problem.kind === "rate-limit"
              ? "Too many attempts"
              : problem.kind === "unauthorized"
                ? "Sign-in or permission required"
                : problem.kind === "network"
                  ? "Connection needs another try"
                  : "Integration unavailable"
      }
    >
      {problem.message}
      {problem.kind === "unauthorized" && (
        <p>
          <Link href="/login?reason=expired">Return to FinPilot sign in</Link>
        </p>
      )}
    </DataState>
  );
}
