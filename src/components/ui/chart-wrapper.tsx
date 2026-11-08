import type { ReactNode } from "react";

/** Chart libraries belong inside this wrapper; always supply an equivalent data view. */
export function ChartWrapper({
  title,
  description,
  children,
  dataTable,
}: {
  title: string;
  description: string;
  children: ReactNode;
  dataTable: ReactNode;
}) {
  return (
    <figure className="chart">
      <figcaption>
        <h2>{title}</h2>
        <p className="muted small">{description}</p>
      </figcaption>
      <div className="chart-plot">{children}</div>
      <details>
        <summary>View chart data</summary>
        {dataTable}
      </details>
    </figure>
  );
}
