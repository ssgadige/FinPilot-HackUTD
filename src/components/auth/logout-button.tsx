"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi, asAuthProblem } from "@/lib/auth-api";
import { useAuth } from "./auth-provider";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const { state, clearSession } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  if (state.status !== "authenticated") return null;
  async function logout() {
    if (request.current || state.status !== "authenticated") return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      await authApi.logout(state.session.csrfToken, controller.signal);
      if (controller.signal.aborted) return;
      clearSession();
      // Clear client identity before navigating and refreshing the server tree.
      router.replace("/login");
      router.refresh();
    } catch (problem) {
      if (!controller.signal.aborted)
        setError(
          `${asAuthProblem(problem).message} Sign-out has not been confirmed.`,
        );
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="logout-control">
      <Button variant="secondary" onClick={logout} disabled={busy}>
        {busy ? "Signing out…" : "Sign out"}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
