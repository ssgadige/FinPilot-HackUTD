import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const Icon =
    tone === "success"
      ? CircleCheck
      : tone === "warning"
        ? TriangleAlert
        : Info;
  return (
    <span className={`badge badge--${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {children}
    </span>
  );
}
