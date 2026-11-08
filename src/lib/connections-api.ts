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
        code === "invalid_simulator_login" ||
        code === "INVALID_CREDENTIALS" ||
        code === "INVALID_INSTITUTION_LOGIN"
      )
        throw new ConnectionProblem(
          "invalid-login",
          "Could not validate the demo credentials. Re-enter your generated institution login; no accounts were linked.",
        );
      if (
        code === "invalid_preview" ||
        code === "expired_institution_code" ||
        code === "PREVIEW_EXPIRED" ||
        code === "INVALID_PREVIEW" ||
        response.status === 410
      )
        throw new ConnectionProblem(
          "expired-preview",
          "This preview has expired. Start institution sign-in and email verification again; no new link is confirmed.",
        );
      if (code === "invalid_institution_code") throw new ConnectionProblem("invalid-login", "Incorrect or consumed institution code. Try again or restart verification.");
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
    // Current authenticated FP-11 handler returns {items}; retain legacy array
    // support for existing catalog fixtures without changing verification gates.
    const rows = Array.isArray(data)
      ? data
      : object(data) && Array.isArray(data.items)
        ? data.items
        : null;
    if (!rows) unavailable();
    const result = rows.map((item: unknown) => {
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
  ): Promise<{ maskedRecipient: string | null; challengeId: string }> {
    const response = await request("/connections/preview", "POST", options, {
      institution_id: institutionId,
      demo_username: username,
      demo_password: password,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!object(data) || !identifier(data.challenge_id) || typeof data.masked_email !== "string") unavailable();
    return { maskedRecipient: data.masked_email, challengeId: data.challenge_id };
  },
  async verify(challengeId: string, code: string, options: Options = {}) {
    const response = await request("/connections/verify", "POST", options, {challenge_id: challengeId, code});
    const data: unknown = await response.json();
    if (!object(data) || !identifier(data.preview_token) || !identifier(data.institution_id) || typeof data.expires_at !== "string" || data.consent_version !== "v1" || !Array.isArray(data.accounts)) unavailable();
    const accounts = data.accounts.map((a: unknown) => {
      if (!object(a) || !identifier(a.id) || typeof a.label !== "string" || typeof a.last_four !== "string" || !Array.isArray(a.records) || !a.records.every((r: unknown) => typeof r === "string")) unavailable();
      return {id:a.id,label:a.label,lastFour:a.last_four,records:a.records as string[]};
    });
    return {institutionId:data.institution_id,previewToken:data.preview_token,expiresAt:data.expires_at,consentVersion:data.consent_version,accounts};
  },
  async resend(challengeId: string, options: Options = {}) {
    await request("/connections/resend", "POST", options, {challenge_id:challengeId});
  },
  async list(options: Options = {}) {
    const response=await request("/connections","GET",options);
    const data:unknown=await response.json();
    if(!object(data)||!Array.isArray(data.items)) unavailable();
    return data.items.map((c:unknown)=>{
      if(!object(c)||!identifier(c.id)||!identifier(c.institution_id)||c.status!=="active"||!Array.isArray(c.account_ids)||!c.account_ids.every(identifier))unavailable();
      return {id:c.id,institutionId:c.institution_id,status:"active" as const,accountIds:c.account_ids as string[],lastSuccessfulSync:typeof c.last_sync_at==="string"?c.last_sync_at:null};
    });
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
    if (response.status !== 204) {
      const data:unknown=await response.json().catch(()=>null);
      if(!object(data)||data.revoked!==true||!Number.isSafeInteger(data.snapshot_version)) unavailable();
    }
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
