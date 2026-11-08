"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";
import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";

/** UX boundary only. Server pages/layout must independently require a verified session. */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "authenticated") return children;
  return (
    <div className="session-pending">
      <Card>
        <DataState
          headingLevel={1}
          state={state.status === "checking" ? "loading" : "empty"}
          title={
            state.status === "checking"
              ? "Checking your session"
              : "Sign in to continue"
          }
        >
          Your financial workspace stays hidden until your session is confirmed.
        </DataState>
        {state.status !== "checking" && (
          <Link href="/login">Return to sign in</Link>
        )}
      </Card>
    </div>
  );
}
