import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props} />;
}

export function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="metric-card">
      <div className="metric-label">
        {label}
        {icon}
      </div>
      <p className="metric-value">{value}</p>
      <p className="muted small">{detail}</p>
    </Card>
  );
}
