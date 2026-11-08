"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  api,
  type Account,
  type Connection,
  type Institution,
  type Overview,
  type Profile,
} from "../../lib/finpilot";
export const WorkspaceContext = createContext<{
  profile: Profile;
  accounts: Account[];
  connections: Connection[];
  institutions: Institution[];
  overview: Overview;
  refresh: () => void;
  notify: (message: string) => void;
  evidence: (id: string) => void;
}>({} as never);
export const useWorkspace = () => useContext(WorkspaceContext);
export function useResource<T>(path: string, epoch = 0) {
  const [state, setState] = useState<{
    path: string;
    epoch: number;
    data?: T;
    error?: string;
  }>({ path: "", epoch: -1 });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ path: "", epoch: -1 });
    api<T>(path, "GET", undefined, controller.signal)
      .then((data) => setState({ path, epoch, data }))
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({ path, epoch, error: e.message });
      });
    return () => controller.abort();
  }, [path, version, epoch]);
  const current = state.path === path && state.epoch === epoch;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
    reload: () => setVersion((v) => v + 1),
  };
}
