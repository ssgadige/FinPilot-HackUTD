import { CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function DataState({
  state,
  title,
  children,
  action,
  headingLevel = 3,
}: {
  state: "loading" | "empty" | "error" | "stale" | "success";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
}) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
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
        <Heading>{title}</Heading>
        {children && <div className="muted small">{children}</div>}
        {state === "loading" && <div className="skeleton" aria-hidden="true" />}
        {action}
      </div>
    </div>
  );
}
