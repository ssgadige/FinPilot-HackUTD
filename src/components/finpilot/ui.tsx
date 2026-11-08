"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { financialDate, money, newKey } from "../../lib/finpilot";
export function Icon({
  name = "grid",
  size = 20,
}: {
  name?: string;
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    bank: (
      <>
        <path d="m3 8 9-5 9 5M3 21h18M5 10v8m7-8v8m7-8v8M3 8h18" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18m-5 5h5" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2" />
      </>
    ),
    repeat: (
      <>
        <path d="m17 3 4 4-4 4M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4m14 0v2a2 2 0 0 1-2 2H3" />
      </>
    ),
    trend: (
      <>
        <path d="m3 17 6-6 4 4 8-10m-6 0h6v6" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      </>
    ),
    sliders: (
      <>
        <path d="M5 3v18M12 3v18M19 3v18" />
        <path d="M2 8h6m1 8h6m1-10h6" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 3-1 3 2 3-2 3-1-1-4 2-3-2-3-3 1-2-3Z" />
      </>
    ),
    chat: (
      <>
        <path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a9 9 0 0 1 18 0Z" />
        <path d="M7 10h10m-10 4h6" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    logout: (
      <>
        <path d="M9 4H4v16h5m6-4 4-4-4-4M9 12h10" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v.1" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
export function Card({
  title,
  children,
  action,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon name={tone === "success" ? "check" : "info"} size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  icon?: string;
}) {
  return (
    <div className="stat card">
      <div className="stat-label">
        {label}
        {icon && (
          <span className="stat-icon">
            <Icon name={icon} />
          </span>
        )}
      </div>
      <strong>{value}</strong>
      <span className="muted small">{note}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div
      className="loading"
      aria-label="Loading financial records"
      role="status"
    >
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span className="muted">Loading your workspace…</span>
    </div>
  );
}
export function Empty({
  title = "Start with your first connection",
  text = "No financial data is shared until you select accounts and consent.",
  link = true,
}: {
  title?: string;
  text?: string;
  link?: boolean;
}) {
  return (
    <Card className="empty">
      <div className="empty-icon">
        <Icon name="bank" size={32} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {link && (
        <Link href="/institutions" className="button">
          Connect an institution <Icon name="arrow" size={16} />
        </Link>
      )}
    </Card>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false),
    request = useRef<{ signature: string; key: string } | null>(null);
  return {
    busy,
    error,
    clear: () => setError(""),
    key: (input: unknown) => {
      const signature = JSON.stringify(input);
      if (request.current?.signature !== signature)
        request.current = { signature, key: newKey() };
      return request.current!.key;
    },
    run: async (fn: () => Promise<void>) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        await fn();
        request.current = null;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to complete request.",
        );
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
  };
}
export function BalanceChart({
  points,
  comparison,
  onEvidence,
}: {
  points: { date: string; balance_cents: number }[];
  comparison?: { date: string; balance_cents: number }[];
  onEvidence?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const selected = points[Math.min(index, points.length - 1)];
  if (!points.length)
    return <p className="muted">No forecast data available.</p>;
  const values = [...points, ...(comparison || [])].map((p) => p.balance_cents);
  const min = Math.min(...values),
    max = Math.max(...values),
    range = Math.max(max - min, 100);
  const coords = (rows: typeof points) =>
    rows
      .map(
        (p, i) =>
          `${42 + (i / Math.max(rows.length - 1, 1)) * 660},${180 - ((p.balance_cents - min) / range) * 145}`,
      )
      .join(" ");
  return (
    <div className="balance-chart">
      <div className="chart-summary">
        <span>
          <i className="legend-dot" />
          {comparison ? "Baseline" : "Projected liquid cash"}
        </span>
        {comparison && (
          <span>
            <i className="legend-dot amber" />
            Scenario
          </span>
        )}
        <strong>{money(selected.balance_cents)}</strong>
      </div>
      <svg
        viewBox="0 0 720 220"
        role="img"
        aria-label={`Cash forecast from ${financialDate(points[0].date)} to ${financialDate(points.at(-1)!.date)}`}
      >
        <defs>
          <linearGradient id="cash-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b8393" stopOpacity=".13" />
            <stop offset="1" stopColor="#0b8393" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 83, 132, 180].map((y) => (
          <line key={y} x1="42" x2="702" y1={y} y2={y} stroke="#e4ecf3" />
        ))}
        <polygon
          points={`42,190 ${coords(points)} 702,190`}
          fill="url(#cash-fill)"
        />
        <polyline
          points={coords(points)}
          fill="none"
          stroke="#088596"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {comparison && (
          <polyline
            points={coords(comparison)}
            fill="none"
            stroke="#c3861b"
            strokeWidth="2.5"
          />
        )}
        <text x="42" y="214">
          {financialDate(points[0].date)}
        </text>
        <text x="702" y="214" textAnchor="end">
          {financialDate(points.at(-1)!.date)}
        </text>
      </svg>
      <div className="chart-controls">
        <label className="small">
          Inspect date{" "}
          <select
            value={Math.min(index, points.length - 1)}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {points.map((p, i) => (
              <option value={i} key={p.date}>
                {financialDate(p.date)} — {money(p.balance_cents)}
              </option>
            ))}
          </select>
        </label>
        {onEvidence && (
          <button className="text-button" onClick={onEvidence}>
            View calculation <Icon name="arrow" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
