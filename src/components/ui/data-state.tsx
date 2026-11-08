import { CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function DataState({
  state,
  title,
  children,
  action,
}: {
  state: "loading" | "empty" | "error" | "stale" | "success";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon =
    state === "loading"
      ? LoaderCircle
      : state === "error" || state === "stale"
        ? TriangleAlert
        : state === "success"
          ? CircleCheck
          : Info;
  return (
    <div
      className={`data-state data-state--${state}`}
      role={state === "error" ? "alert" : "status"}
      aria-busy={state === "loading"}
    >
      <Icon size={22} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        {children && <div className="muted small">{children}</div>}
        {state === "loading" && <div className="skeleton" aria-hidden="true" />}
        {action}
      </div>
    </div>
  );
}
