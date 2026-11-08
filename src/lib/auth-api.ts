/** Same-origin browser adapter. Cookies remain managed by the server/browser. */
export type Profile = { id: string; display_name: string; email: string };
export type Challenge = { challenge_id: string; masked_email: string };
export type Session = { profile: Profile; csrfToken: string | null };
export type AuthProblemKind =
  | "credentials"
  | "wrong-code"
  | "expired-code"
  | "rate-limit"
  | "session-expired"
  | "network"
  | "unavailable"
  | "csrf";

export class AuthProblem extends Error {
  constructor(
    public kind: AuthProblemKind,
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}

function retrySeconds(value: string | null) {
  if (!value) return 60;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 60;
}

async function request(
  path: string,
  options: {
    body?: unknown;
    csrfToken?: string;
    signal?: AbortSignal;
    expected: number;
  },
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: options.body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.csrfToken ? { "X-CSRF-Token": options.csrfToken } : {}),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    });
    if (response.status !== options.expected) {
      const data = await response.json().catch(() => null);
      const code: unknown = data?.error?.code;
      // Only known machine codes are interpreted. Never reflect arbitrary provider messages.
      if (response.status === 429)
        throw new AuthProblem(
          "rate-limit",
          "Too many attempts. Wait before trying again.",
          retrySeconds(response.headers.get("Retry-After")),
        );
      if (
        code === "CODE_EXPIRED" ||
        code === "OTP_EXPIRED" ||
        code === "CHALLENGE_EXPIRED"
      )
        throw new AuthProblem(
          "expired-code",
          "That code has expired. Request a new code; your financial session has not started.",
        );
      if (
        code === "SESSION_EXPIRED" ||
        code === "CHALLENGE_NOT_FOUND" ||
        (response.status === 401 &&
          path !== "/auth/login" &&
          path !== "/auth/verify")
      )
        throw new AuthProblem(
          "session-expired",
          "Your session has expired. Sign in again to continue.",
        );
      if (response.status === 401 && path === "/auth/login")
        throw new AuthProblem(
          "credentials",
          "We could not sign you in. Check your email and application password.",
        );
      if (
        (response.status === 400 || response.status === 401) &&
        path === "/auth/verify"
      )
        throw new AuthProblem(
          "wrong-code",
          "That code could not be verified. Enter the latest six-digit code.",
        );
      if (response.status === 403)
        throw new AuthProblem(
          "csrf",
          "This request could not be confirmed. Refresh your session and try again.",
        );
      throw new AuthProblem(
        "unavailable",
        "Sign-in service is unavailable. Please try again later. Your financial workspace remains locked.",
      );
    }
    return response;
  } catch (error) {
    if (options.signal?.aborted)
      throw new DOMException("Aborted", "AbortError");
    if (error instanceof AuthProblem) throw error;
    throw new AuthProblem(
      "network",
      "We could not reach the sign-in service. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

function unavailable(): never {
  throw new AuthProblem(
    "unavailable",
    "The sign-in service returned an unexpected response. Please try again later.",
  );
}

export const authApi = {
  async me(signal?: AbortSignal): Promise<Session> {
    const response = await request("/me", { expected: 200, signal });
    const profile = await response.json().catch(() => null);
    if (
      !profile ||
      typeof profile.id !== "string" ||
      typeof profile.display_name !== "string" ||
      typeof profile.email !== "string"
    )
      unavailable();
    // Integration dependency: FP-10 must supply a session-bound CSRF token.
    // Proposed transport is a GET /me response header, never a session token.
    return {
      profile: {
        id: profile.id,
        display_name: profile.display_name,
        email: profile.email,
      },
      csrfToken: response.headers.get("X-CSRF-Token"),
    };
  },
  async login(
    email: string,
    password: string,
    signal?: AbortSignal,
  ): Promise<Challenge> {
    const response = await request("/auth/login", {
      expected: 202,
      body: { email, password },
      signal,
    });
    const data = await response.json().catch(() => null);
    if (
      !data ||
      typeof data.challenge_id !== "string" ||
      !data.challenge_id ||
      typeof data.masked_email !== "string" ||
      !data.masked_email
    )
      unavailable();
    return { challenge_id: data.challenge_id, masked_email: data.masked_email };
  },
  async verify(challenge_id: string, code: string, signal?: AbortSignal) {
    await request("/auth/verify", {
      expected: 200,
      body: { challenge_id, code },
      signal,
    });
  },
  async resend(challenge_id: string, signal?: AbortSignal) {
    await request("/auth/resend", {
      expected: 202,
      body: { challenge_id },
      signal,
    });
  },
  async logout(csrfToken: string | null, signal?: AbortSignal) {
    if (!csrfToken)
      throw new AuthProblem(
        "unavailable",
        "Sign-out is unavailable because the server did not supply its CSRF protection. Your session has not been revoked.",
      );
    await request("/auth/logout", {
      expected: 204,
      body: {},
      csrfToken,
      signal,
    });
  },
};

export function asAuthProblem(error: unknown): AuthProblem {
  return error instanceof AuthProblem
    ? error
    : new AuthProblem(
        "unavailable",
        "Sign-in is unavailable. Please try again later.",
      );
}
