/** Accounts use the shared FP-04/FP-12 contract. Other financial models still
 * require integration agreement. Unknown/incomplete shapes fail closed;
 * no fixture fallback or financial arithmetic. See IMPLEMENTATION.md.
 */
import type {
  AccountSummary,
  AccountsResponse,
  Page,
  SourceMode,
} from "../../contracts/types";

export type Meta = {
  snapshot_version: string | number;
  source_mode?: SourceMode;
  as_of?: string;
  assumptions?: string[];
  missing_inputs?: string[];
};
export type Account = AccountSummary;
export type Transaction = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  category?: string;
  amount_cents: number;
  classification?: "charge" | "income" | "transfer" | "payment";
  status?: "posted" | "pending";
};
export type Indicator = {
  key: string;
  value?: number | null;
  unit?: "months" | "percent";
  numerator_cents?: number | null;
  denominator_cents?: number | null;
  explanation?: string;
  source_mode?: Meta["source_mode"];
  missing_inputs?: string[];
};
export type Commitment = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount_cents: number;
  transaction_id?: string;
};
export type Accounts = Meta & AccountsResponse;
export type Transactions = Meta & Page<Transaction>;
export type Overview = Meta & {
  liquid_cash_cents?: number | null;
  debt_cents?: number | null;
  net_worth_cents?: number | null;
  investments_cents?: number | null;
  indicators?: Indicator[];
  upcoming_bills?: Commitment[];
};
export type Forecast = Meta & {
  account_ids: string[];
  balances: { date: string; balance_cents: number }[];
  events: Commitment[];
  low_cash_date: string | null;
  low_cash_explanation?: string;
};
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): v is ObjectValue =>
  !!v && typeof v === "object" && !Array.isArray(v);
const cents = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const date = (v: unknown) =>
  str(v) &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
const strings = (v: unknown) => Array.isArray(v) && v.every(str);
const optional = (v: unknown, check: (v: unknown) => boolean) =>
  v === undefined || check(v);
const modes = (v: unknown) => ["live", "fixture", "cached"].includes(String(v));
const meta = (v: ObjectValue) =>
  (str(v.snapshot_version) || cents(v.snapshot_version)) &&
  optional(v.source_mode, modes) &&
  optional(v.as_of, (v) => str(v) && !Number.isNaN(Date.parse(v))) &&
  optional(v.assumptions, strings) &&
  optional(v.missing_inputs, strings);
const moneyFields = (v: ObjectValue, fields: string[]) =>
  fields.every((k) => v[k] === null || optional(v[k], cents));
const account = (v: unknown) =>
  object(v) &&
  str(v.id) &&
  str(v.label) &&
  [
    "checking",
    "savings",
    "credit_card",
    "auto_loan",
    "mortgage",
    "brokerage",
    "ira",
    "cd",
  ].includes(String(v.kind)) &&
  optional(v.last_four, (v) => typeof v === "string" && /^\d{4}$/.test(v)) &&
  moneyFields(v, ["balance_cents"]) &&
  optional(v.maturity_date, (v) => v === null || date(v)) &&
  optional(v.last_sync_at, (v) => str(v) && !Number.isNaN(Date.parse(v)));
const transaction = (v: unknown) =>
  object(v) &&
  str(v.id) &&
  str(v.account_id) &&
  date(v.date) &&
  str(v.description) &&
  cents(v.amount_cents) &&
  optional(v.category, str) &&
  optional(v.classification, (v) =>
    ["charge", "income", "transfer", "payment"].includes(String(v)),
  ) &&
  optional(v.status, (v) => v === "posted" || v === "pending");
const commitment = (v: unknown) =>
  object(v) &&
  str(v.id) &&
  str(v.account_id) &&
  date(v.date) &&
  str(v.description) &&
  cents(v.amount_cents) &&
  optional(v.transaction_id, str);
const indicator = (v: unknown) =>
  object(v) &&
  str(v.key) &&
  optional(
    v.value,
    (v) => v === null || (typeof v === "number" && Number.isFinite(v)),
  ) &&
  optional(v.unit, (v) => v === "months" || v === "percent") &&
  moneyFields(v, ["numerator_cents", "denominator_cents"]) &&
  optional(v.explanation, str) &&
  optional(v.source_mode, modes) &&
  optional(v.missing_inputs, strings);
const array = (v: unknown, check: (v: unknown) => boolean) =>
  Array.isArray(v) && v.every(check);
export class FinanceError extends Error {
  constructor(
    public readonly kind:
      | "auth"
      | "revoked"
      | "snapshot"
      | "network"
      | "unavailable"
      | "rate-limit"
      | "filters"
      | "contract",
  ) {
    super(kind);
  }
}
export function financeMessage(error: unknown) {
  const kind = error instanceof FinanceError ? error.kind : "network";
  return {
    auth: "Your session expired. Return to login.",
    revoked:
      "Account access was revoked or disconnected. Financial records have been cleared.",
    snapshot:
      "The financial snapshot changed. Refresh all financial data before continuing.",
    network: "The network request failed. Check your connection and retry.",
    unavailable:
      "The financial service is unavailable. No sample balances have been substituted.",
    "rate-limit": "Too many requests. Wait before retrying.",
    filters:
      "Choose an end date on or after the start date to load transaction history.",
    contract:
      "This financial response is unavailable because its schema is not yet supported. FP-12 integration is required.",
  }[kind];
}
async function request<T>(
  path: string,
  valid: (v: ObjectValue) => boolean,
  signal: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new FinanceError("network");
  }
  if (!response.ok)
    throw new FinanceError(
      response.status === 401
        ? "auth"
        : response.status === 403
          ? "revoked"
          : response.status === 409
            ? "snapshot"
            : response.status === 429
              ? "rate-limit"
              : "unavailable",
    );
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new FinanceError("contract");
  }
  if (!object(value) || !meta(value) || !valid(value))
    throw new FinanceError("contract");
  return value as T;
}
export type Filters = {
  q: string;
  account_id: string;
  category: string;
  from: string;
  to: string;
};
export const emptyFilters: Filters = {
  q: "",
  account_id: "",
  category: "",
  from: "",
  to: "",
};
export const financeApi = {
  accounts: (signal: AbortSignal) =>
    request<Accounts>(
      "accounts",
      (v) =>
        array(v.items, account) &&
        (v.next_cursor === undefined || v.next_cursor === null) &&
        new Set((v.items as Account[]).map((a) => a.id)).size ===
          (v.items as Account[]).length,
      signal,
    ),
  transactions: (
    filters: Filters,
    cursor: string | null,
    signal: AbortSignal,
  ) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value) query.set(key, value);
    if (cursor) query.set("cursor", cursor);
    return request<Transactions>(
      `transactions${query.size ? `?${query}` : ""}`,
      (v) =>
        array(v.items, transaction) &&
        (v.next_cursor === null || str(v.next_cursor)) &&
        new Set((v.items as Transaction[]).map((t) => t.id)).size ===
          (v.items as Transaction[]).length,
      signal,
    );
  },
  overview: (signal: AbortSignal) =>
    request<Overview>(
      "overview",
      (v) =>
        moneyFields(v, [
          "liquid_cash_cents",
          "debt_cents",
          "net_worth_cents",
          "investments_cents",
        ]) &&
        optional(v.indicators, (v) => array(v, indicator)) &&
        optional(v.upcoming_bills, (v) => array(v, commitment)),
      signal,
    ),
  forecast: (days: 30 | 90, signal: AbortSignal) =>
    request<Forecast>(
      `forecast?days=${days}`,
      (v) =>
        strings(v.account_ids) &&
        array(
          v.balances,
          (v) => object(v) && date(v.date) && cents(v.balance_cents),
        ) &&
        (v.balances as Forecast["balances"]).every(
          (point, index, all) =>
            index === 0 || point.date > all[index - 1].date,
        ) &&
        array(v.events, commitment) &&
        (v.low_cash_date === null || date(v.low_cash_date)) &&
        optional(v.low_cash_explanation, str),
      signal,
    ),
};
export function usd(value: number | undefined | null) {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value / 100)
    : "Unavailable";
}
