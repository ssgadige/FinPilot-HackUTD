import { beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { AuthScreen } from "../../src/components/finpilot/auth";
import { WorkspaceContext } from "../../src/components/finpilot/context";
import { Workspace } from "../../src/components/finpilot/workspace";
import { Institutions } from "../../src/components/finpilot/connection-views";
import { Calculators } from "../../src/components/finpilot/planning-views";
import { api, inputCents } from "../../src/lib/finpilot";
let dom: JSDOM, root: Root, container: HTMLElement;
const originalFetch = globalThis.fetch;
let pushes: string[], replaces: string[];
const router: AppRouterInstance = {
  push: (href) => pushes.push(href),
  replace: (href) => replaces.push(href),
  back() {},
  forward() {},
  refresh() {},
  prefetch() {},
  bfcacheId: "test",
};
const baseContext = {
  profile: {
    id: "test-user",
    display_name: "Fictional User",
    email: "fictional@example.test",
    simulation: true,
  },
  accounts: [],
  connections: [],
  institutions: [
    { id: "demo", name: "Demo Bank", category: "banks", simulated: 1 },
  ],
  overview: {
    liquid_cash_cents: 0,
    debt_cents: 0,
    net_worth_cents: 0,
    income_cents: 0,
    spending_cents: 0,
    snapshot_version: 1,
    as_of: "2026-11-07",
    missing_data: ["No accounts linked"],
    indicators: [],
    upcoming_bills: [],
  },
  refresh() {},
  notify(_message: string) {},
  evidence(_id: string) {},
};
beforeEach(() => {
  dom = new JSDOM('<!doctype html><div id="test-root"></div>', {
    url: "http://localhost:3000",
  });
  Object.assign(globalThis, {
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    FormData: dom.window.FormData,
    sessionStorage: dom.window.sessionStorage,
    Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  Object.assign(dom.window.HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  container = document.getElementById("test-root")!;
  root = createRoot(container);
  pushes = [];
  replaces = [];
});
afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  globalThis.fetch = originalFetch;
});
async function render(children: ReactNode, search = "") {
  await act(async () => {
    root.render(
      <AppRouterContext.Provider value={router}>
        <SearchParamsContext.Provider value={new URLSearchParams(search)}>
          <WorkspaceContext.Provider value={baseContext}>
            {children}
          </WorkspaceContext.Provider>
        </SearchParamsContext.Provider>
      </AppRouterContext.Provider>,
    );
  });
}
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 15));
  });
}
async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await settle();
}
async function click(button: HTMLElement) {
  await act(async () => button.click());
  await settle();
}
function fill(name: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  input.value = value;
}
test("login uses real request shape and stores challenge metadata without password or OTP", async () => {
  let body: any;
  globalThis.fetch = async (_path, options) => {
    body = JSON.parse(String(options?.body));
    return Response.json(
      { challenge_id: "test-challenge", masked_email: "f***@example.test" },
      { status: 202 },
    );
  };
  await render(<AuthScreen />);
  fill("email", "fictional@example.test");
  fill("password", "fixture-password-only");
  await submit(container.querySelector("form")!);
  assert.deepEqual(body, {
    email: "fictional@example.test",
    password: "fixture-password-only",
  });
  assert.deepEqual(pushes, ["/verify"]);
  const stored = sessionStorage.getItem("fp_challenge")!;
  assert.ok(stored.includes("test-challenge"));
  assert.ok(!stored.includes("fixture-password-only"));
  assert.ok(!stored.includes("password"));
});
test("login failure is announced and does not route into a financial page", async () => {
  globalThis.fetch = async () =>
    Response.json(
      { error: { code: "invalid_login", message: "Invalid credentials" } },
      { status: 401 },
    );
  await render(<AuthScreen />);
  fill("email", "fictional@example.test");
  fill("password", "fixture-password-only");
  await submit(container.querySelector("form")!);
  assert.match(
    container.querySelector('[role="alert"]')!.textContent!,
    /Invalid credentials/,
  );
  assert.deepEqual(pushes, []);
  assert.equal(
    (container.querySelector('[name="email"]') as HTMLInputElement).value,
    "fictional@example.test",
  );
});
test("verification needs a pending challenge and offers a sign-in recovery path", async () => {
  await render(<AuthScreen verify />);
  assert.match(container.textContent!, /no pending verification/);
  assert.equal(container.querySelector('a[href="/sign-in"]') !== null, true);
  assert.equal(
    container.querySelector('input[autocomplete="one-time-code"]'),
    null,
  );
});
test("empty financial workspace does not present zero balances as financial conclusions", async () => {
  globalThis.fetch = async (path) => {
    const p = String(path);
    return Response.json(
      p.endsWith("overview")
        ? baseContext.overview
        : p.startsWith("/api/v1/forecast")
          ? { dated_balances: [], missing_data: ["No accounts linked"] }
          : { items: [] },
    );
  };
  await render(<Workspace screen="overview" profile={baseContext.profile} />);
  await settle();
  assert.match(container.textContent!, /Start with your first connection/);
  assert.ok(!container.textContent!.includes("$0.00"));
  assert.ok(container.querySelector('a[href="/institutions"]'));
});
test("calculator submits inputs to the server and displays its returned result", async () => {
  let body: any;
  globalThis.fetch = async (_path, options) => {
    body = JSON.parse(String(options?.body));
    return Response.json(
      {
        payment_cents: 30422,
        interest_cents: 95192,
        total_paid_cents: 1095192,
        payoff_months: 36,
        remaining_cents: 0,
        schedule: [],
        assumptions: ["Server calculation"],
        evidence_ids: ["test-evidence"],
      },
      { status: 201 },
    );
  };
  await render(<Calculators />);
  fill("principal", "10000");
  fill("rate", "6.00");
  fill("months", "36");
  fill("extra", "0");
  await submit(container.querySelector("form")!);
  assert.deepEqual(body, {
    kind: "loan",
    principal_cents: 1000000,
    apr_bps: 600,
    months: 36,
    extra_payment_cents: 0,
  });
  assert.match(container.textContent!, /\$304\.22/);
  assert.match(container.textContent!, /Server calculation/);
});
test("API client sends same-origin credentials and CSRF on mutations and announces session expiry", async () => {
  document.cookie = "fp_csrf=fixture-csrf";
  let options: RequestInit | undefined;
  let expired = false;
  window.addEventListener("finpilot:expired", () => {
    expired = true;
  });
  globalThis.fetch = async (_path, opts) => {
    options = opts;
    return Response.json(
      { error: { code: "unauthenticated", message: "Sign in again" } },
      { status: 401 },
    );
  };
  await assert.rejects(api("goals", "POST", { title: "Goal" }));
  assert.equal(options?.credentials, "same-origin");
  assert.equal(
    (options?.headers as Record<string, string>)["x-csrf-token"],
    "fixture-csrf",
  );
  assert.equal(expired, true);
  assert.equal(inputCents("12.34"), 1234);
  assert.throws(() => inputCents("12.345"));
});
test("consent excludes already-connected accounts and keeps explicit consent unchecked", async () => {
  const context = {
    ...baseContext,
    connections: [
      {
        id: "c",
        institution_id: "demo",
        last_sync_at: null,
        account_ids: ["existing"],
        status: "active",
      },
    ],
  };
  globalThis.fetch = async () =>
    Response.json({
      preview_token: "fixture-preview",
      accounts: [
        {
          id: "existing",
          label: "Existing",
          last_four: "1000",
          kind: "checking",
        },
        { id: "new", label: "New account", last_four: "1001", kind: "savings" },
      ],
    });
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router}>
        <WorkspaceContext.Provider value={context}>
          <Institutions />
        </WorkspaceContext.Provider>
      </AppRouterContext.Provider>,
    ),
  );
  await click(
    [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Add accounts"),
    )!,
  );
  fill("username", "fictional.demo");
  fill("password", "fixture-password-only");
  await submit(container.querySelector("form")!);
  const boxes = [
    ...container.querySelectorAll<HTMLInputElement>(".account-options input"),
  ];
  assert.equal(boxes[0].disabled, true);
  assert.equal(boxes[0].checked, false);
  assert.equal(boxes[1].checked, true);
  assert.equal(
    container.querySelector<HTMLInputElement>(".checkbox-label input")!.checked,
    false,
  );
  assert.equal(
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === "Connect selected accounts",
    )!.disabled,
    true,
  );
});
test("expired verification cannot be submitted and offers a fresh sign-in", async () => {
  sessionStorage.setItem(
    "fp_challenge",
    JSON.stringify({
      challenge_id: "expired-fixture",
      masked_email: "f***@example.test",
      expires: Date.now() - 1000,
      resend: Date.now() - 1000,
    }),
  );
  await render(<AuthScreen verify />);
  assert.match(container.textContent!, /That code has expired/);
  assert.equal(
    container.querySelector<HTMLInputElement>('[autocomplete="one-time-code"]')!
      .disabled,
    true,
  );
  assert.equal(
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent === "Resend code",
    )!.disabled,
    true,
  );
  assert.ok(
    [...container.querySelectorAll("a")].some(
      (a) => a.textContent === "Sign in again",
    ),
  );
});
test("unavailable agent runtime is displayed without invented specialist completion", async () => {
  const { Agents } = await import("../../src/components/finpilot/agent-views");
  globalThis.fetch = async (path) =>
    Response.json(
      String(path).endsWith("/events")
        ? {
            items: [
              {
                id: "event-fixture",
                agent_id: "coordinator",
                type: "failed",
                at: "2026-11-07T12:00:00Z",
                message: "Nemotron runtime unavailable",
              },
            ],
            next_cursor: "event-fixture",
          }
        : {
            id: "run-fixture",
            status: "failed",
            error_code: "runtime_unavailable",
            stale: false,
            snapshot_version: 1,
            steps: [],
          },
    );
  await render(<Agents />, "run=run-fixture");
  await settle();
  assert.match(container.textContent!, /specialist runtime is not installed/);
  assert.match(container.textContent!, /0 of 9/);
  assert.ok(!container.textContent!.includes("Findings backed by evidence"));
});
test("uncertain mutation retries preserve the idempotency key until success", async () => {
  const { useAction } = await import("../../src/components/finpilot/ui");
  const keys: string[] = [];
  let attempts = 0;
  globalThis.fetch = async (_path, options) => {
    keys.push(JSON.parse(String(options?.body)).idempotency_key);
    if (++attempts === 1) throw Error("Network temporarily unavailable");
    return Response.json({ saved: true });
  };
  function ActionHarness() {
    const action = useAction();
    return (
      <>
        <button
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api("demo/events", "POST", {
                idempotency_key: action.key({ amount: 100 }),
              });
            })
          }
        >
          Save fixture
        </button>
        {action.error && <p role="alert">{action.error}</p>}
      </>
    );
  }
  await render(<ActionHarness />);
  await click(container.querySelector("button")!);
  assert.match(container.textContent!, /Network temporarily unavailable/);
  await click(container.querySelector("button")!);
  await click(container.querySelector("button")!);
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});
test("transaction merchant text is rendered as text and preserves account filters", async () => {
  const { Transactions } =
    await import("../../src/components/finpilot/finance-views");
  const merchant = '<img src=x onerror="alert(1)">';
  let queried = "";
  globalThis.fetch = async (path) => {
    queried = String(path);
    return Response.json({
      items: [
        {
          id: "fixture-tx",
          account_id: "fixture-account",
          posted_date: "2026-10-29",
          merchant,
          category: "shopping",
          delta_cents: -1000,
          transfer_group: null,
        },
      ],
      next_cursor: null,
    });
  };
  const context = {
    ...baseContext,
    accounts: [
      {
        id: "fixture-account",
        institution_id: "demo",
        kind: "checking",
        label: "Fixture checking",
        last_four: "1000",
        balance_cents: 10000,
        last_sync_at: null,
        source_mode: "fixture" as const,
      },
    ],
  };
  await act(async () =>
    root.render(
      <AppRouterContext.Provider value={router}>
        <SearchParamsContext.Provider
          value={new URLSearchParams("account_id=fixture-account")}
        >
          <WorkspaceContext.Provider value={context}>
            <Transactions />
          </WorkspaceContext.Provider>
        </SearchParamsContext.Provider>
      </AppRouterContext.Provider>,
    ),
  );
  await settle();
  assert.ok(queried.includes("account_id=fixture-account"));
  assert.ok(container.textContent!.includes(merchant));
  assert.equal(container.querySelector("img"), null);
});
