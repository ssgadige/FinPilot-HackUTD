export type Profile = {
  id: string;
  display_name: string;
  email: string;
  simulation: boolean;
};
export type Account = {
  id: string;
  institution_id: string;
  kind: string;
  label: string;
  last_four: string;
  balance_cents: number;
  last_sync_at: string | null;
  source_mode: "fixture";
};
export type Institution = {
  id: string;
  name: string;
  category: string;
  simulated: number;
};
export type Connection = {
  id: string;
  institution_id: string;
  last_sync_at: string | null;
  account_ids: string[];
  status: string;
};
export type Transaction = {
  id: string;
  account_id: string;
  posted_date: string;
  merchant: string;
  category: string;
  delta_cents: number;
  transfer_group: string | null;
};
export type Overview = {
  liquid_cash_cents: number;
  debt_cents: number;
  net_worth_cents: number;
  income_cents: number;
  spending_cents: number;
  snapshot_version: number;
  as_of: string;
  missing_data: string[];
  indicators: { key: string; value: number | null; explanation: string }[];
  upcoming_bills: {
    id: string;
    account_id: string;
    label: string;
    amount_cents: number;
    day_of_month: number;
  }[];
};
export type Forecast = {
  dated_balances: { date: string; balance_cents: number }[];
  low_cash_date: string;
  low_cash_cents: number;
  snapshot_version: number;
  assumptions: string[];
  evidence_ids: string[];
  missing_data: string[];
  as_of: string;
};
export type Goal = {
  id: string;
  title: string;
  target_cents: number;
  saved_cents: number;
  deadline: string;
  priority: number;
  version: number;
};
export type Subscription = {
  id: string;
  account_id: string;
  merchant: string;
  cadence: string;
  amount_cents: number;
  status: string;
  usage_confirmed: string | null;
  preferences_json: string;
};
export type Debt = {
  id: string;
  balance_cents: number;
  apr_bps: number | null;
  minimum_payment_cents: number | null;
  credit_limit_cents: number | null;
  utilization_bps: number | null;
};
export type Plan = {
  id: string;
  version: number;
  status: string;
  stale: boolean;
  snapshot_version: number;
  payload: unknown;
  created_at: string;
};
export type Run = {
  id: string;
  status: string;
  error_code: string | null;
  stale: boolean;
  snapshot_version: number;
  steps: { agent_id: string; status: string; result_json: string | null }[];
};
export type Event = {
  id: string;
  agent_id: string;
  type: string;
  at: string;
  message: string;
};
export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const csrf =
    typeof document === "undefined"
      ? ""
      : document.cookie
          .split("; ")
          .find((v) => v.startsWith("fp_csrf="))
          ?.slice(8) || "";
  const response = await fetch("/api/v1/" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: {
      "content-type": "application/json",
      ...(method === "GET" ? {} : { "x-csrf-token": csrf }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.dispatchEvent(new Event("finpilot:expired"));
    throw new RequestError(
      response.status,
      data?.error?.code || "request_failed",
      data?.error?.message || "Unable to complete request",
    );
  }
  return data as T;
}
export const money = (cents: number | null | undefined) =>
  cents == null
    ? "Not available"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(cents / 100);
export const financialDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
export const titleCase = (text: string) =>
  text.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export const newKey = () => crypto.randomUUID();
export function inputCents(value: FormDataEntryValue | null) {
  const v = String(value || "");
  if (!/^\d+(\.\d{1,2})?$/.test(v))
    throw Error("Enter a valid amount with up to two decimal places.");
  const [whole, part = ""] = v.split(".");
  const amount = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw Error("Amount is too large.");
  return amount;
}
