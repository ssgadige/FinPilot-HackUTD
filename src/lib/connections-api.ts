/** Browser adapter: documented same-origin simulator endpoints only. No bank URLs. */
export const institutionCategories = [
  "banks",
  "cards",
  "investments",
  "loans",
  "wallets",
] as const;
export type InstitutionCategory = (typeof institutionCategories)[number];
export type Institution = {
  id: string;
  name: string;
  category: InstitutionCategory;
};
export type ConnectionProblemKind =
  | "invalid-login"
  | "expired-preview"
  | "unauthorized"
  | "rate-limit"
  | "network"
  | "unavailable";
export class ConnectionProblem extends Error {
  constructor(
    public kind: ConnectionProblemKind,
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}
export function connectionProblem(error: unknown) {
  return error instanceof ConnectionProblem
    ? error
    : new ConnectionProblem(
        "unavailable",
        "This simulator operation is unavailable. No successful connection is confirmed.",
      );
}
type Options = { signal?: AbortSignal; csrfToken?: string | null };
function unavailable(): never {
  throw new ConnectionProblem(
    "unavailable",
    "The simulator returned an unsupported response. The operation is unconfirmed; contact the integration owner.",
  );
}
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 256;

async function request(
  path: string,
  method: "GET" | "POST" | "DELETE",
  options: Options,
  body?: unknown,
): Promise<Response> {
  if (method !== "GET" && !options.csrfToken)
    throw new ConnectionProblem(
      "unavailable",
      "The server has not supplied CSRF protection. This operation is unavailable and was not sent.",
    );
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(method === "GET"
          ? {}
          : {
              "Content-Type": "application/json",
              "X-CSRF-Token": options.csrfToken!,
            }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const code =
        object(payload) && object(payload.error) ? payload.error.code : null;
      if (response.status === 429) {
        const retry = response.headers.get("Retry-After");
        const seconds =
          retry && /^\d+$/.test(retry)
            ? Number(retry)
            : retry
              ? Math.ceil((Date.parse(retry) - Date.now()) / 1000)
              : 60;
        throw new ConnectionProblem(
          "rate-limit",
          "Too many attempts. Wait before trying this operation again.",
          Number.isFinite(seconds) ? Math.max(1, seconds) : 60,
        );
      }
      if (
        code === "INVALID_CREDENTIALS" ||
        code === "INVALID_INSTITUTION_LOGIN"
      )
        throw new ConnectionProblem(
          "invalid-login",
          "Could not validate the demo credentials. Re-enter your generated institution login; no accounts were linked.",
        );
      if (
        code === "PREVIEW_EXPIRED" ||
        code === "INVALID_PREVIEW" ||
        response.status === 410
      )
        throw new ConnectionProblem(
          "expired-preview",
          "This preview has expired. Start institution sign-in and email verification again; no new link is confirmed.",
        );
      if (response.status === 401 || response.status === 403)
        throw new ConnectionProblem(
          "unauthorized",
          "This operation is not authorized. Sign in again or refresh your session. No additional access is confirmed.",
        );
      throw new ConnectionProblem(
        "unavailable",
        "The institution service is unavailable. Please try again later. Connection status is unconfirmed.",
      );
    }
    return response;
  } catch (error) {
    if (options.signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
    if (error instanceof ConnectionProblem) throw error;
    throw new ConnectionProblem(
      "network",
      "Could not reach the simulator. Check your connection. Retry the same link or sync request to resolve its unconfirmed result safely.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export type LinkRequest = {
  previewToken: string;
  institutionId: string;
  accountIds: string[];
  consentVersion: string;
  idempotencyKey: string;
};
export type LinkReceipt = {
  connectionId: string;
  institutionId: string;
  accountIds: string[];
  lastSuccessfulSync: string | null;
};

export const connectionsApi = {
  async institutions(options: Options = {}): Promise<Institution[]> {
    const response = await request("/institutions", "GET", options);
    const data: unknown = await response.json().catch(() => null);
    if (!Array.isArray(data)) unavailable();
    const result = data.map((item: unknown) => {
      if (
        !object(item) ||
        !identifier(item.id) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        !institutionCategories.includes(item.category as InstitutionCategory)
      )
        unavailable();
      return {
        id: item.id,
        name: item.name,
        category: item.category as InstitutionCategory,
      };
    });
    if (new Set(result.map((item) => item.id)).size !== result.length)
      unavailable();
    return result;
  },
  async startPreview(
    institutionId: string,
    username: string,
    password: string,
    options: Options = {},
  ): Promise<{ maskedRecipient: string | null }> {
    const response = await request("/connections/preview", "POST", options, {
      institution_id: institutionId,
      demo_username: username,
      demo_password: password,
    });
    const data: unknown = await response.json().catch(() => null);
    // PR #26 requires an institution OTP BEFORE a preview can be released.
    // The verify/resend contract is unconfirmed. Never return a legacy preview
    // token or account labels from this response, even if the backend sends them.
    return {
      maskedRecipient:
        object(data) &&
        typeof data.masked_email === "string" &&
        data.masked_email.includes("*")
          ? data.masked_email
          : null,
    };
  },
  async link(input: LinkRequest, options: Options = {}): Promise<LinkReceipt> {
    const response = await request("/connections", "POST", options, {
      preview_token: input.previewToken,
      account_ids: input.accountIds,
      consent_version: input.consentVersion,
      idempotency_key: input.idempotencyKey,
    });
    const data: unknown = await response.json().catch(() => null);
    // Provisional decoder, isolated here for FP-11 coordination; not a listing API.
    if (!object(data) || !object(data.connection)) unavailable();
    const item = data.connection;
    if (
      !identifier(item.id) ||
      item.institution_id !== input.institutionId ||
      item.status !== "active" ||
      !Array.isArray(item.account_ids) ||
      !item.account_ids.every(identifier) ||
      new Set(item.account_ids).size !== item.account_ids.length ||
      [...item.account_ids].sort().join("\0") !==
        [...input.accountIds].sort().join("\0")
    )
      unavailable();
    return {
      connectionId: item.id,
      institutionId: input.institutionId,
      accountIds: [...item.account_ids],
      lastSuccessfulSync:
        typeof item.last_sync_at === "string" &&
        Number.isFinite(Date.parse(item.last_sync_at))
          ? item.last_sync_at
          : null,
    };
  },
  async sync(
    connectionId: string,
    idempotencyKey: string,
    options: Options = {},
  ): Promise<number> {
    const response = await request(
      `/connections/${encodeURIComponent(connectionId)}/sync`,
      "POST",
      options,
      { idempotency_key: idempotencyKey },
    );
    const data: unknown = await response.json().catch(() => null);
    if (
      !object(data) ||
      typeof data.snapshot_version !== "number" ||
      !Number.isSafeInteger(data.snapshot_version) ||
      data.snapshot_version < 0
    )
      unavailable();
    return data.snapshot_version;
  },
  async disconnect(connectionId: string, options: Options = {}) {
    const response = await request(
      `/connections/${encodeURIComponent(connectionId)}`,
      "DELETE",
      options,
      { confirmation: true },
    );
    if (response.status !== 204) unavailable();
  },
  async accounts(options: Options = {}): Promise<unknown> {
    const response = await request("/accounts", "GET", options);
    return response.json().catch(() => unavailable());
  },
  async refreshOverview(options: Options = {}) {
    const response = await request("/overview", "GET", options);
    await response.json().catch(() => unavailable());
  },
};
