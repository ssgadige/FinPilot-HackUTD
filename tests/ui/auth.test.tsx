import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthFlow } from "@/components/auth/auth-flow";
import { LogoutButton } from "@/components/auth/logout-button";
import { WorkspaceGate } from "@/components/auth/workspace-gate";
import { authApi, AuthProblem } from "@/lib/auth-api";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const profile = {
  id: "test-user",
  display_name: "Test User",
  email: "fictional@example.test",
};
const challenge = {
  challenge_id: "test-challenge",
  masked_email: "f***@example.test",
};
type Handler = (options: RequestInit) => Response | Promise<Response>;
let handlers: Record<string, Handler>;
let fetchMock: ReturnType<typeof vi.fn>;
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const error = (
  code: string,
  status: number,
  headers?: Record<string, string>,
) =>
  json(
    {
      error: {
        code,
        message: "Untrusted server message must not be reflected",
        request_id: "test",
      },
    },
    status,
    headers,
  );

beforeEach(() => {
  vi.clearAllMocks();
  handlers = { "/api/v1/me": () => error("UNAUTHENTICATED", 401) };
  fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    const handler = handlers[url];
    if (!handler) throw new Error("Unexpected request in test");
    return handler(options);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function beginChallenge() {
  const user = userEvent.setup();
  handlers["/api/v1/auth/login"] = () => json(challenge, 202);
  const view = render(
    <AuthProvider>
      <AuthFlow />
    </AuthProvider>,
  );
  await screen.findByRole("heading", { name: "Welcome back" });
  await user.type(
    screen.getByLabelText("Email", { exact: true }),
    "fictional@example.test",
  );
  await user.type(
    screen.getByLabelText("Password", { exact: true }),
    "test-only-password",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith("/login/verify"),
  );
  view.rerender(
    <AuthProvider>
      <AuthFlow verification />
    </AuthProvider>,
  );
  await screen.findByRole("heading", { level: 1, name: "Check your email" });
  return { user, ...view };
}

describe("login and pending verification", () => {
  it("validates fields, toggles password visibility, posts credentials and requires a challenge", async () => {
    const user = userEvent.setup();
    let resolveLogin!: (value: Response) => void;
    handlers["/api/v1/auth/login"] = (options) => {
      expect(options.method).toBe("POST");
      expect(options.credentials).toBe("same-origin");
      expect(options.cache).toBe("no-store");
      expect(JSON.parse(String(options.body))).toEqual({
        email: "fictional@example.test",
        password: "test-only-password",
      });
      return new Promise((resolve) => {
        resolveLogin = resolve;
      });
    };
    const view = render(
      <AuthProvider>
        <AuthFlow />
      </AuthProvider>,
    );
    await screen.findByRole("heading", { name: "Welcome back" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Email", { exact: true })).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.type(
      screen.getByLabelText("Email", { exact: true }),
      "fictional@example.test",
    );
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "test-only-password",
    );
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => resolveLogin(json(challenge, 202)));
    expect(router.push).toHaveBeenCalledWith("/login/verify");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
    view.rerender(
      <AuthProvider>
        <AuthFlow verification />
      </AuthProvider>,
    );
    expect(screen.getByText(/f\*\*\*@example.test/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
    expect(screen.queryByText("You’re signed in")).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it.each([
    ["INVALID_CODE", 401, "Check your code"],
    ["CODE_EXPIRED", 400, "That code has expired"],
  ])(
    "shows %s without opening the workspace",
    async (code, status, heading) => {
      const { user } = await beginChallenge();
      handlers["/api/v1/auth/verify"] = (options) => {
        expect(JSON.parse(String(options.body))).toEqual({
          challenge_id: challenge.challenge_id,
          code: "123456",
        });
        return error(String(code), Number(status));
      };
      const input = screen.getByLabelText("Email code");
      await user.click(input);
      await user.paste("123 456");
      expect(input).toHaveValue("123456");
      await user.click(
        screen.getByRole("button", { name: "Verify and sign in" }),
      );
      await waitFor(() =>
        expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
          String(heading),
        ),
      );
      expect(router.replace).not.toHaveBeenCalledWith("/");
      expect(input).toHaveValue("");
      expect(
        screen.queryByText(/Untrusted server message/),
      ).not.toBeInTheDocument();
    },
  );

  it("enforces the resend cooldown, posts the challenge, resets the code and timer", async () => {
    const { user } = await beginChallenge();
    handlers["/api/v1/auth/resend"] = (options) => {
      expect(JSON.parse(String(options.body))).toEqual({
        challenge_id: challenge.challenge_id,
      });
      return json({}, 202);
    };
    fireEvent.change(screen.getByLabelText("Email code"), {
      target: { value: "123456" },
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
    const resend = await screen.findByRole(
      "button",
      { name: "Request new code" },
      { timeout: 2500 },
    );
    expect(resend).toBeEnabled();
    await user.click(resend);
    expect(screen.getByLabelText("Email code")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Resend in/ })).toBeDisabled();
    expect(screen.getByText(/A new code was requested/)).toBeInTheDocument();
  });

  it("uses Retry-After for rate limits and treats challenge expiry as server-controlled", async () => {
    const { user } = await beginChallenge();
    handlers["/api/v1/auth/verify"] = () =>
      error("RATE_LIMITED", 429, { "Retry-After": "120" });
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify and sign in" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts",
    );
    expect(
      screen.getByRole("button", { name: "Verify and sign in" }),
    ).toBeDisabled();
    const advanced = Date.now() + 121000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(advanced);
    await waitFor(
      () =>
        expect(
          screen.getByRole("button", { name: "Verify and sign in" }),
        ).toBeEnabled(),
      { timeout: 2500 },
    );
    clock.mockReturnValue(advanced + 181000);
    await waitFor(
      () =>
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
          "That code has expired",
        ),
      { timeout: 2500 },
    );
    expect(
      screen.queryByRole("button", { name: "Verify and sign in" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email code")).toBeDisabled();
  });

  it("keeps an expired challenge disabled when requesting a new code fails", async () => {
    const { user } = await beginChallenge();
    handlers["/api/v1/auth/verify"] = () => error("CODE_EXPIRED", 400);
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify and sign in" }),
    );
    await screen.findByRole("heading", {
      level: 1,
      name: "That code has expired",
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
    const resend = await screen.findByRole(
      "button",
      { name: "Request new code" },
      { timeout: 2500 },
    );
    handlers["/api/v1/auth/resend"] = () => {
      throw new TypeError("offline");
    };
    await waitFor(() => expect(resend).toBeEnabled(), { timeout: 2500 });
    await user.click(resend);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "That code has expired",
    );
    expect(
      screen.queryByRole("button", { name: "Verify and sign in" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email code")).toBeDisabled();
  });

  it("requires GET /me confirmation after a successful verify response", async () => {
    const { user } = await beginChallenge();
    handlers["/api/v1/auth/verify"] = () => json({});
    handlers["/api/v1/me"] = () =>
      json(profile, 200, { "X-CSRF-Token": "test-csrf" });
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify and sign in" }),
    );
    await screen.findByRole("heading", { name: "You’re signed in" });
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/v1/me"),
    ).toHaveLength(2);
  });

  it("does not treat a verify response as a session when GET /me rejects it", async () => {
    const { user } = await beginChallenge();
    handlers["/api/v1/auth/verify"] = () => json({});
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify and sign in" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "could not be confirmed",
      ),
    );
    expect(router.replace).not.toHaveBeenCalledWith("/");
  });

  it("shows session expiry and clears the pending challenge", async () => {
    const { user } = await beginChallenge();
    handlers["/api/v1/auth/verify"] = () => error("SESSION_EXPIRED", 401);
    await user.type(screen.getByLabelText("Email code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify and sign in" }),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/login?reason=expired"),
    );
    expect(
      screen.queryByRole("textbox", { name: "Email code" }),
    ).not.toBeInTheDocument();
  });

  it("preserves login input on network failure and exposes a retryable state", async () => {
    const user = userEvent.setup();
    handlers["/api/v1/auth/login"] = () => {
      throw new TypeError("offline");
    };
    render(
      <AuthProvider>
        <AuthFlow />
      </AuthProvider>,
    );
    await screen.findByRole("heading", { name: "Welcome back" });
    await user.type(
      screen.getByLabelText("Email", { exact: true }),
      "fictional@example.test",
    );
    await user.type(
      screen.getByLabelText("Password", { exact: true }),
      "test-only-password",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection and try again",
    );
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue(
      "fictional@example.test",
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("shows honest unavailable service and malformed response errors", async () => {
    handlers["/api/v1/me"] = () => json({}, 404);
    render(
      <AuthProvider>
        <AuthFlow />
      </AuthProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in service is unavailable",
    );
    handlers["/api/v1/auth/login"] = () => json({ authenticated: true }, 202);
    await expect(
      authApi.login("fictional@example.test", "test-only-password"),
    ).rejects.toBeInstanceOf(AuthProblem);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("session visibility and logout", () => {
  it("hides navigation and financial children while pending and when not authenticated", async () => {
    let resolveMe!: (value: Response) => void;
    handlers["/api/v1/me"] = () =>
      new Promise((resolve) => {
        resolveMe = resolve;
      });
    render(
      <AuthProvider>
        <WorkspaceGate>
          <nav>Financial navigation</nav>
          <div>Private balance</div>
        </WorkspaceGate>
      </AuthProvider>,
    );
    expect(screen.getByText("Checking your session")).toBeInTheDocument();
    expect(screen.queryByText("Private balance")).not.toBeInTheDocument();
    await act(async () => resolveMe(error("UNAUTHENTICATED", 401)));
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Private balance")).not.toBeInTheDocument();
  });

  it("only clears identity and navigates after the backend confirms revocation", async () => {
    const user = userEvent.setup();
    handlers["/api/v1/me"] = () =>
      json(profile, 200, { "X-CSRF-Token": "test-csrf" });
    handlers["/api/v1/auth/logout"] = () => {
      throw new TypeError("offline");
    };
    render(
      <AuthProvider>
        <WorkspaceGate>
          <div>Private balance</div>
          <LogoutButton />
        </WorkspaceGate>
      </AuthProvider>,
    );
    await screen.findByText("Private balance");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-out has not been confirmed",
    );
    expect(screen.getByText("Private balance")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
    handlers["/api/v1/auth/logout"] = (options) => {
      expect(options.headers).toMatchObject({ "X-CSRF-Token": "test-csrf" });
      return json(null, 204);
    };
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("Private balance")).not.toBeInTheDocument();
  });

  it("does not send logout without a server-supplied CSRF token", async () => {
    handlers["/api/v1/me"] = () => json(profile);
    render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Sign out" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "CSRF protection",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
