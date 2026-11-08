"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  asAuthProblem,
  type AuthProblem,
  type Challenge,
  type Session,
} from "@/lib/auth-api";

type AuthState =
  | { status: "checking" }
  | { status: "anonymous" }
  | { status: "authenticated"; session: Session }
  | { status: "unavailable"; problem: AuthProblem };
type PendingChallenge = Challenge & {
  expiresAt: number;
  resendAt: number;
  expiredByServer: boolean;
};
type AuthContextValue = {
  state: AuthState;
  challenge: PendingChallenge | null;
  setChallenge: React.Dispatch<React.SetStateAction<PendingChallenge | null>>;
  refresh: (signal?: AbortSignal) => Promise<boolean>;
  clearSession: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "checking" });
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setState({ status: "checking" });
    try {
      const session = await authApi.me(signal);
      if (signal?.aborted) {
        setState({ status: "anonymous" });
        return false;
      }
      setState({ status: "authenticated", session });
      setChallenge(null);
      return true;
    } catch (error) {
      if (signal?.aborted) {
        setState({ status: "anonymous" });
        return false;
      }
      const problem = asAuthProblem(error);
      setState(
        problem.kind === "session-expired"
          ? { status: "anonymous" }
          : { status: "unavailable", problem },
      );
      return false;
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    // The initial state is already checking. Resolve it from the network response.
    void authApi
      .me(controller.signal)
      .then((session) => {
        if (!controller.signal.aborted)
          setState({ status: "authenticated", session });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const problem = asAuthProblem(error);
        setState(
          problem.kind === "session-expired"
            ? { status: "anonymous" }
            : { status: "unavailable", problem },
        );
      });
    return () => controller.abort();
  }, []);
  const clearSession = useCallback(() => {
    setState({ status: "anonymous" });
    setChallenge(null);
  }, []);
  return (
    <AuthContext.Provider
      value={{ state, challenge, setChallenge, refresh, clearSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
