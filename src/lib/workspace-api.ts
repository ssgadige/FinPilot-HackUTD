/** DTOs follow inspected FP-12/14 handlers. No response fixtures or financial formulas. */
import type { AgentResult, Offer, RunEvent } from "../../contracts/types";
export type Subscription = {
  id: string;
  account_id: string;
  merchant: string;
  cadence: string;
  amount_cents: number;
  status: string;
  usage_confirmed: "used" | "unused" | "unknown" | null;
  preferences: Record<string, string | boolean>;
};
export type Goal = {
  id: string;
  title: string;
  target_cents: number;
  saved_cents?: number;
  deadline: string;
  priority: number;
  version?: number;
};
export type GoalInput = Pick<
  Goal,
  "title" | "target_cents" | "deadline" | "priority"
>;
export type Plan = {
  id: string;
  version: number;
  status: string;
  snapshot_version: number;
  stale: boolean;
  payload: null | {
    allocations: {
      kind: string;
      target_id: string;
      monthly_cents: number;
      day_of_month: number;
    }[];
    reserve_cents: number;
    evidence_ids: string[];
    assumptions: string[];
  };
};
export type Debt = {
  id: string;
  balance_cents: number;
  apr_bps?: number | null;
  minimum_payment_cents?: number | null;
  credit_limit_cents?: number | null;
  utilization_bps?: number | null;
};
export type Calculation = {
  source_mode?: string;
  assumptions: string[];
  evidence_ids?: string[];
  dated_balances?: { date: string; balance_cents: number }[];
  low_cash_cents?: number;
  low_cash_date?: string;
  reserve_cents?: number;
  reserve_breached?: boolean;
  payment_cents?: number;
  interest_cents?: number;
  total_paid_cents?: number;
  payoff_months?: number;
  remaining_cents?: number;
  schedule?: {
    month: number;
    payment_cents: number;
    interest_cents: number;
    balance_cents: number;
  }[];
  snapshot_version?: number;
};
// Prepared run boundary only: these HTTP routes are currently absent. Confirm envelope with FP-15/23.
export type RunView = {
  id: string;
  status: string;
  snapshot_version: number;
  model_status?: string;
  steps: { agent_id: string; status: string; result?: AgentResult }[];
  partial?: boolean;
};
export class WorkspaceProblem extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const integer = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v);
function requireShape(ok: unknown): asserts ok {
  if (!ok) throw new WorkspaceProblem(502, "unsupported_response");
}
export function workspaceMessage(error: unknown) {
  const p = error instanceof WorkspaceProblem ? error : null;
  if (p?.status === 401) return "Your session expired. Sign in again.";
  if (p?.status === 403)
    return "Access was revoked. Financial records have been cleared.";
  if (p?.status === 409)
    return "This record or plan changed. Review the latest version before trying again.";
  if (p?.status === 429) return "Too many requests. Wait before retrying.";
  if (p?.code === "unsupported_response")
    return "The service returned an unsupported response. This section is unavailable.";
  if (p?.status === 404)
    return "This record or integration is unavailable. It may have been disconnected or is not implemented yet.";
  if (p && p.status >= 500)
    return "This service is unavailable. No replacement data or successful result has been invented.";
  return "The network request failed. Your input is preserved; retry when connected.";
}
/** A successful HTTP status alone is not a saved preference, intention or plan. */
export function savedRecord(
  value: unknown,
  expectedId?: string,
  expectedStatus?: string,
): Record<string, unknown> {
  requireShape(
    obj(value) &&
      text(value.id) &&
      (!expectedId || value.id === expectedId) &&
      (!expectedStatus || value.status === expectedStatus),
  );
  return value;
}
export async function workspaceRequest(
  path: string,
  signal: AbortSignal,
  options?: { method: "POST" | "PATCH"; body: unknown; csrf: string | null },
): Promise<unknown> {
  if (options && !options.csrf)
    throw new WorkspaceProblem(503, "csrf_unavailable");
  let r: Response;
  try {
    r = await fetch("/api/v1/" + path, {
      method: options?.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      headers: {
        Accept: "application/json",
        ...(options
          ? {
              "Content-Type": "application/json",
              "X-CSRF-Token": options.csrf!,
            }
          : {}),
      },
      ...(options ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new WorkspaceProblem(0, "network");
  }
  const data: unknown = await r.json().catch(() => null);
  if (!r.ok)
    throw new WorkspaceProblem(
      r.status,
      obj(data) && obj(data.error) && typeof data.error.code === "string"
        ? data.error.code
        : "service_error",
    );
  return data;
}
function items(data: unknown): unknown[] {
  requireShape(obj(data) && Array.isArray(data.items));
  return data.items as unknown[];
}
function preferences(v: unknown): Record<string, string | boolean> {
  if (typeof v !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(v);
    if (!obj(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, v]) => typeof v === "string" || typeof v === "boolean",
      ),
    ) as Record<string, string | boolean>;
  } catch {
    return {};
  }
}
export const workspaceApi = {
  async subscriptions(signal: AbortSignal): Promise<Subscription[]> {
    return items(await workspaceRequest("subscriptions", signal)).map((v) => {
      requireShape(
        obj(v) &&
          text(v.id) &&
          text(v.account_id) &&
          text(v.merchant) &&
          text(v.cadence) &&
          integer(v.amount_cents) &&
          text(v.status) &&
          [null, "used", "unused", "unknown"].includes(
            v.usage_confirmed as string | null,
          ),
      );
      return {
        ...v,
        preferences: preferences(v.preferences_json),
      } as unknown as Subscription;
    });
  },
  async goals(signal: AbortSignal): Promise<Goal[]> {
    return items(await workspaceRequest("goals", signal)).map((v) => {
      requireShape(
        obj(v) &&
          text(v.id) &&
          text(v.title) &&
          integer(v.target_cents) &&
          text(v.deadline) &&
          integer(v.priority),
      );
      return v as unknown as Goal;
    });
  },
  async debts(signal: AbortSignal): Promise<Debt[]> {
    return items(await workspaceRequest("debts", signal)).map((v) => {
      requireShape(obj(v) && text(v.id) && integer(v.balance_cents));
      return v as unknown as Debt;
    });
  },
  async plans(signal: AbortSignal): Promise<Plan[]> {
    return items(await workspaceRequest("plans", signal)).map((v) => {
      requireShape(
        obj(v) &&
          text(v.id) &&
          integer(v.version) &&
          text(v.status) &&
          integer(v.snapshot_version) &&
          typeof v.stale === "boolean" &&
          (v.payload === null ||
            (obj(v.payload) &&
              Array.isArray(v.payload.allocations) &&
              Array.isArray(v.payload.evidence_ids) &&
              Array.isArray(v.payload.assumptions) &&
              integer(v.payload.reserve_cents))),
      );
      return v as unknown as Plan;
    });
  },
  async offers(id: string, signal: AbortSignal): Promise<Offer[]> {
    return items(
      await workspaceRequest(
        "subscriptions/" + encodeURIComponent(id) + "/offers",
        signal,
      ),
    ).map((v) => {
      requireShape(
        obj(v) &&
          text(v.id) &&
          text(v.provider) &&
          text(v.plan) &&
          ["fixture", "live", "cached"].includes(String(v.source_mode)) &&
          integer(v.monthly_equivalent_cents) &&
          integer(v.upfront_cents) &&
          Array.isArray(v.eligibility) &&
          Array.isArray(v.features) &&
          v.currency === "USD",
      );
      return v as unknown as Offer;
    });
  },
  async calculation(
    path: "calculations" | "scenarios",
    body: unknown,
    csrf: string | null,
    signal: AbortSignal,
  ): Promise<Calculation> {
    const d = await workspaceRequest(path, signal, {
      method: "POST",
      body,
      csrf,
    });
    requireShape(obj(d) && Array.isArray(d.assumptions));
    return d as unknown as Calculation;
  },
  async evidence(id: string, signal: AbortSignal) {
    const d = await workspaceRequest(
      "evidence/" + encodeURIComponent(id),
      signal,
    );
    requireShape(
      obj(d) &&
        text(d.id) &&
        text(d.kind) &&
        text(d.source_mode) &&
        text(d.source_id) &&
        text(d.observed_at),
    );
    return {
      id: d.id,
      kind: d.kind,
      source_mode: d.source_mode,
      source_id: d.source_id,
      observed_at: d.observed_at,
    };
  },
  async run(id: string, signal: AbortSignal): Promise<RunView> {
    const d = await workspaceRequest("runs/" + encodeURIComponent(id), signal);
    requireShape(
      obj(d) &&
        text(d.id) &&
        d.id === id &&
        [
          "queued",
          "running",
          "completed",
          "failed",
          "cancelled",
          "partial",
        ].includes(String(d.status)) &&
        integer(d.snapshot_version) &&
        Array.isArray(d.steps) &&
        (d.model_status === undefined || typeof d.model_status === "string") &&
        d.steps.every(
          (step) =>
            obj(step) &&
            text(step.agent_id) &&
            text(step.status) &&
            (!step.result ||
              (obj(step.result) &&
                text(step.result.headline) &&
                Array.isArray(step.result.assumptions) &&
                step.result.assumptions.every(text) &&
                Array.isArray(step.result.missing_data) &&
                step.result.missing_data.every(text) &&
                Array.isArray(step.result.findings) &&
                step.result.findings.every(
                  (f) =>
                    obj(f) &&
                    text(f.id) &&
                    text(f.summary) &&
                    Array.isArray(f.evidence_ids) &&
                    f.evidence_ids.every(text),
                ))),
        ),
    );
    return d as unknown as RunView;
  },
  async events(
    id: string,
    cursor: string | null,
    signal: AbortSignal,
  ): Promise<{ items: RunEvent[]; next_cursor: string | null }> {
    const d = await workspaceRequest(
      "runs/" +
        encodeURIComponent(id) +
        "/events" +
        (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      signal,
    );
    const rows = items(d);
    requireShape(
      obj(d) &&
        (d.next_cursor === null || typeof d.next_cursor === "string") &&
        rows.every(
          (v) =>
            obj(v) &&
            text(v.id) &&
            text(v.agent_id) &&
            text(v.type) &&
            text(v.message) &&
            text(v.at),
        ),
    );
    return d as unknown as { items: RunEvent[]; next_cursor: string | null };
  },
};
/** User input conversion only; not a financial forecast or total. */
export function inputCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [d, c = ""] = value.split(".");
  const n = Number(d) * 100 + Number(c.padEnd(2, "0"));
  return Number.isSafeInteger(n) && n <= 100_000_000 ? n : null;
}
export function rate(bps: unknown) {
  return integer(bps) ? `${(bps / 100).toFixed(2)}%` : "Unavailable";
}
