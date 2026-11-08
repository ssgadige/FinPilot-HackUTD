import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { InstitutionCatalog } from "@/components/connections/institution-catalog";
import { ProviderLinkDialog } from "@/components/connections/provider-link-dialog";
import { AccountConsent } from "@/components/connections/account-consent";
import { ConnectionManager } from "@/components/connections/connection-manager";
import { ConnectionProblem, connectionsApi } from "@/lib/connections-api";
import {
  confirmedConnectionFixture,
  providerFixtures,
  verifiedPreviewFixture,
} from "../fixtures/institutions";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
type Handler = (options: RequestInit) => Response | Promise<Response>;
let handlers: Record<string, Handler>;
let fetchMock: ReturnType<typeof vi.fn>;
let csrf: string;
const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const fail = (code: string, status: number, headers?: Record<string, string>) =>
  json(
    { error: { code, message: "Untrusted server message" } },
    status,
    headers,
  );
beforeEach(() => {
  vi.clearAllMocks();
  csrf = crypto.randomUUID();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {
      this.removeAttribute("open");
    },
  });
  handlers = {
    "GET /api/v1/me": () =>
      json(
        {
          id: "test-person",
          display_name: "Test person",
          email: "person@example.test",
        },
        200,
        { "X-CSRF-Token": csrf },
      ),
    "GET /api/v1/institutions": () => json(providerFixtures),
    "GET /api/v1/connections": () => json({items:[]}),
    "GET /api/v1/accounts": () => json({items:[],snapshot_version:1,source_mode:"fixture",as_of:"2026-01-01"}),
  };
  fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    const handler = handlers[`${options.method||"GET"} ${url}`];
    if (!handler) throw new Error("Unexpected test request");
    return handler(options);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("institution discovery", () => {
  it("discovers PNC, Bank of America and Chase in Banks, searches, and changes all categories", async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <InstitutionCatalog />
      </AuthProvider>,
    );
    for (const name of ["PNC", "Bank of America", "Chase"])
      expect(
        await screen.findByRole("button", { name: `Connect ${name}` }),
      ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search providers"), "america");
    expect(
      screen.getByRole("button", { name: "Connect Bank of America" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect PNC" }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search providers"));
    await user.type(
      screen.getByLabelText("Search providers"),
      "no matching institution",
    );
    expect(screen.getByText("No matching providers")).toBeInTheDocument();
    for (const [category, provider] of [
      ["Cards", "American Express"],
      ["Investments", "Fidelity"],
      ["Loans", "Demo Auto Finance"],
      ["Wallets", "PayPal"],
    ]) {
      await user.click(
        screen.getByRole("button", { name: new RegExp(`^${category}`) }),
      );
      expect(screen.getByLabelText("Search providers")).toHaveValue("");
      expect(
        screen.getByRole("button", { name: `Connect ${provider}` }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("heading", { name: "Saved connections" }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.every(([url]) => url.startsWith("/api/v1/")),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/v1/connections"),
    ).toBe(true);
  });

  it("handles a pending directory, empty result, service error and retry", async () => {
    let finish!: (response: Response) => void;
    handlers["GET /api/v1/institutions"] = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const view = render(
      <AuthProvider>
        <InstitutionCatalog />
      </AuthProvider>,
    );
    expect(await screen.findByText("Loading institutions")).toBeInTheDocument();
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    await act(async () => finish(json([])));
    expect(screen.getByText("No matching providers")).toBeInTheDocument();
    view.unmount();
    handlers["GET /api/v1/institutions"] = () => fail("UNAVAILABLE", 503);
    render(
      <AuthProvider>
        <InstitutionCatalog />
      </AuthProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Institution directory unavailable",
    );
    handlers["GET /api/v1/institutions"] = () => json(providerFixtures);
    await userEvent.click(
      screen.getByRole("button", { name: "Retry directory" }),
    );
    expect(
      await screen.findByRole("button", { name: "Connect PNC" }),
    ).toBeInTheDocument();
  });
});

describe("simulator credentials and institution verification boundary", () => {
  it("clears both credentials immediately, blocks duplicates and reports invalid login", async () => {
    const user = userEvent.setup();
    const password = crypto.randomUUID();
    let finish!: (response: Response) => void;
    handlers["POST /api/v1/connections/preview"] = (options) => {
      expect(JSON.parse(String(options.body))).toEqual({
        institution_id: "chase",
        demo_username: "generated.person@example.test",
        demo_password: password,
      });
      expect(options.headers).toMatchObject({ "X-CSRF-Token": csrf });
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    render(
      <ProviderLinkDialog
        provider={providerFixtures[2]}
        csrfToken={csrf}
        onClose={vi.fn()}
      />,
    );
    await user.type(
      screen.getByLabelText("Demo email or username"),
      "generated.person@example.test",
    );
    await user.type(
      screen.getByLabelText("Generated institution password"),
      password,
    );
    const form = screen
      .getByLabelText("Demo email or username")
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(screen.getByLabelText("Demo email or username")).toHaveValue("");
    expect(screen.getByLabelText("Generated institution password")).toHaveValue(
      "",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Contacting simulator…" }),
    ).toBeDisabled();
    await act(async () => finish(fail("INVALID_CREDENTIALS", 400)));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not validate the demo credentials",
    );
    expect(screen.getByLabelText("Generated institution password")).toHaveValue(
      "",
    );
    expect(
      screen.queryByText("Untrusted server message"),
    ).not.toBeInTheDocument();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("clears credentials on cancel/provider change and never exposes a legacy preview", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const view = render(
      <ProviderLinkDialog
        key="chase"
        provider={providerFixtures[2]}
        csrfToken={csrf}
        onClose={close}
      />,
    );
    const secret = crypto.randomUUID();
    await user.type(
      screen.getByLabelText("Generated institution password"),
      secret,
    );
    await user.click(
      screen.getByRole("button", { name: "Cancel institution linking" }),
    );
    expect(screen.getByLabelText("Generated institution password")).toHaveValue(
      "",
    );
    expect(close).toHaveBeenCalledOnce();
    view.rerender(
      <ProviderLinkDialog
        key="pnc"
        provider={providerFixtures[0]}
        csrfToken={csrf}
        onClose={close}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Connect PNC" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Generated institution password")).toHaveValue(
      "",
    );
    handlers["POST /api/v1/connections/preview"] = () =>
      json({
        preview_token: crypto.randomUUID(),
        accounts: [{ label: "Must never be exposed" }],
        masked_email: "p***@example.test",
        challenge_id: crypto.randomUUID(),
      });
    await user.type(
      screen.getByLabelText("Demo email or username"),
      "generated.person@example.test",
    );
    await user.type(
      screen.getByLabelText("Generated institution password"),
      crypto.randomUUID(),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Continue to institution verification",
      }),
    );
    expect(
      await screen.findByText("Verify your institution email"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Must never be exposed")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Institution email code")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Verify institution email" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^Resend institution code/ }),
    ).toBeDisabled();
    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it.each([
    ["SESSION_EXPIRED", 401, "unauthorized"],
    ["RATE_LIMITED", 429, "rate-limit"],
    ["PREVIEW_EXPIRED", 410, "expired-preview"],
  ])(
    "maps %s without disclosing raw server messages",
    async (code, status, kind) => {
      handlers["POST /api/v1/connections/preview"] = () =>
        fail(String(code), Number(status), { "Retry-After": "90" });
      await expect(
        connectionsApi.startPreview(
          "chase",
          "generated.person@example.test",
          crypto.randomUUID(),
          { csrfToken: csrf },
        ),
      ).rejects.toMatchObject({
        kind,
        ...(kind === "rate-limit" ? { retryAfter: 90 } : {}),
      });
    },
  );

  it("clears credentials when the network fails or CSRF protection is unavailable", async () => {
    const user = userEvent.setup();
    handlers["POST /api/v1/connections/preview"] = () => {
      throw new TypeError("offline");
    };
    const view = render(
      <ProviderLinkDialog
        provider={providerFixtures[2]}
        csrfToken={csrf}
        onClose={vi.fn()}
      />,
    );
    for (const label of [
      "Demo email or username",
      "Generated institution password",
    ])
      await user.type(screen.getByLabelText(label), crypto.randomUUID());
    await user.click(
      screen.getByRole("button", {
        name: "Continue to institution verification",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
    expect(screen.getByLabelText("Generated institution password")).toHaveValue(
      "",
    );
    view.unmount();
    await expect(
      connectionsApi.startPreview(
        "chase",
        "generated.person@example.test",
        crypto.randomUUID(),
        { csrfToken: null },
      ),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("prepared post-verification consent", () => {
  it("links only explicitly selected accounts after consent, preserves retry intent and waits for confirmation", async () => {
    const user = userEvent.setup();
    const preview = verifiedPreviewFixture();
    const bodies: Record<string, unknown>[] = [];
    let finish!: (response: Response) => void;
    handlers["POST /api/v1/connections"] = (options) => {
      bodies.push(JSON.parse(String(options.body)));
      if (bodies.length === 1) throw new TypeError("offline");
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    render(
      <AccountConsent
        preview={preview}
        csrfToken={csrf}
        onStartAgain={vi.fn()}
      />,
    );
    expect(
      screen
        .getAllByRole("checkbox")
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
    const submit = screen.getByRole("button", {
      name: "Connect selected accounts",
    });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /^I authorize/ }));
    expect(submit).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: /^Example checking/ }),
    );
    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
    expect(bodies[0].account_ids).toEqual(["test-checking"]);
    expect(
      screen.getByRole("checkbox", { name: /^Example savings/ }),
    ).toBeDisabled();
    const form = screen
      .getByRole("button", { name: "Retry same link request" })
      .closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(
      screen.queryByText("Connected · server confirmed"),
    ).not.toBeInTheDocument();
    await act(async () =>
      finish(
        json({
          connection: {
            id: "test-linked",
            institution_id: "chase",
            status: "active",
            account_ids: ["test-checking"],
            last_sync_at: null,
          },
        }),
      ),
    );
    expect(
      screen.getByText("Connected · server confirmed"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Example savings")).not.toBeInTheDocument();
    expect(screen.getByText(/Not supplied by the server/)).toBeInTheDocument();
  });

  it("expires safely and resets consent when the verified preview changes", async () => {
    const preview = verifiedPreviewFixture();
    const user = userEvent.setup();
    const view = render(
      <AccountConsent
        preview={preview}
        csrfToken={csrf}
        onStartAgain={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("checkbox", { name: /^Example checking/ }),
    );
    await user.click(screen.getByRole("checkbox", { name: /^I authorize/ }));
    view.rerender(
      <AccountConsent
        preview={verifiedPreviewFixture()}
        csrfToken={csrf}
        onStartAgain={vi.fn()}
      />,
    );
    expect(
      screen
        .getAllByRole("checkbox")
        .every((box) => !(box as HTMLInputElement).checked),
    ).toBe(true);
    view.rerender(
      <AccountConsent
        preview={{
          ...verifiedPreviewFixture(),
          expiresAt: "2020-01-01T00:00:00Z",
        }}
        csrfToken={csrf}
        onStartAgain={vi.fn()}
      />,
    );
    expect(screen.getByText("Preview expired")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connect selected accounts" }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a receipt for an unselected account instead of claiming success", async () => {
    handlers["POST /api/v1/connections"] = () =>
      json({
        connection: {
          id: "unexpected",
          institution_id: "chase",
          status: "active",
          account_ids: ["another-account"],
        },
      });
    await expect(
      connectionsApi.link(
        {
          previewToken: crypto.randomUUID(),
          institutionId: "chase",
          accountIds: ["test-checking"],
          consentVersion: "test-version",
          idempotencyKey: crypto.randomUUID(),
        },
        { csrfToken: csrf },
      ),
    ).rejects.toBeInstanceOf(ConnectionProblem);
  });
});

describe("confirmed connection lifecycle", () => {
  it("preserves the sync key after failure, prevents duplicate requests and uses a new key after success", async () => {
    const keys: string[] = [];
    let finish!: (response: Response) => void;
    handlers["POST /api/v1/connections/test-connection/sync"] = (options) => {
      keys.push(JSON.parse(String(options.body)).idempotency_key);
      if (keys.length === 1) throw new TypeError("offline");
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    render(
      <ConnectionManager
        connection={confirmedConnectionFixture()}
        csrfToken={csrf}
        onReconnect={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sync records" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
    const retry = screen.getByRole("button", {
      name: "Retry same sync request",
    });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(
      screen.getByText(/Sync request in progress. Waiting/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sync confirmed")).not.toBeInTheDocument();
    await act(async () => finish(json({ snapshot_version: 2 })));
    expect(screen.getByText("Sync confirmed")).toBeInTheDocument();
    expect(
      screen.getByText(/A newer sync timestamp has not been supplied/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sync records" }));
    expect(keys).toHaveLength(3);
    expect(keys[2]).not.toBe(keys[1]);
    await act(async () => finish(json({ snapshot_version: 3 })));
  });

  it("requires explicit disconnect, waits for revocation, clears records before refreshing and can reconnect", async () => {
    const user = userEvent.setup();
    const reconnect = vi.fn();
    const order: string[] = [];
    const invalidate = () => {
      order.push("invalidate");
    };
    window.addEventListener("finpilot:finance-invalidated", invalidate);
    let finish!: (response: Response) => void;
    handlers["DELETE /api/v1/connections/test-connection"] = (options) => {
      expect(JSON.parse(String(options.body))).toEqual({ confirmation: true });
      return new Promise((resolve) => {
        finish = resolve;
      });
    };
    handlers["GET /api/v1/accounts"] = (options) => {
      order.push("accounts");
      expect(options.cache).toBe("no-store");
      return json([{ label: "Must not reappear after disconnect" }]);
    };
    handlers["GET /api/v1/overview"] = () => {
      order.push("overview");
      throw new TypeError("offline");
    };
    render(
      <ConnectionManager
        connection={confirmedConnectionFixture()}
        csrfToken={csrf}
        onReconnect={reconnect}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(
      screen.getByRole("button", { name: "Confirm disconnect" }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: /^I confirm/ }));
    await user.click(
      screen.getByRole("button", { name: "Confirm disconnect" }),
    );
    expect(screen.getByText("Example checking")).toBeInTheDocument();
    await act(async () => finish(json(null, 204)));
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.queryByText("Example checking")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Must not reappear after disconnect"),
    ).not.toBeInTheDocument();
    expect(order).toEqual(["invalidate", "accounts", "overview"]);
    expect(
      screen.getByText("Updated financial data unavailable"),
    ).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", {
        name: "Reconnect with institution verification",
      }),
    );
    expect(reconnect).toHaveBeenCalledOnce();
    window.removeEventListener("finpilot:finance-invalidated", invalidate);
  });

  it("retains the confirmed connection when disconnect fails and does not refresh data", async () => {
    const user = userEvent.setup();
    handlers["DELETE /api/v1/connections/test-connection"] = () =>
      fail("UNAUTHORIZED", 403);
    render(
      <ConnectionManager
        connection={confirmedConnectionFixture()}
        csrfToken={csrf}
        onReconnect={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await user.click(screen.getByRole("checkbox", { name: /^I confirm/ }));
    await user.click(
      screen.getByRole("button", { name: "Confirm disconnect" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "not authorized",
    );
    expect(screen.getByText("Example checking")).toBeInTheDocument();
    expect(screen.queryByText("Disconnected")).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
