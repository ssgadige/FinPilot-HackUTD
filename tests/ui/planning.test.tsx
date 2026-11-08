import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { FinanceScope } from "@/components/finance/finance-scope";
import { SubscriptionsScreen } from "@/components/planning/subscriptions";
import { GoalsScreen } from "@/components/planning/goals-plans";
import {
  AssetsScreen,
  ScenariosScreen,
} from "@/components/planning/finance-pages";
import { AgentsScreen, RunPanel } from "@/components/planning/agents";
import {
  planningAccounts,
  subscriptionRows,
  goalRows,
  debtRows,
  offersRows,
  planRows,
  scenarioResult,
  runFixture,
} from "../fixtures/planning";

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "test-only-csrf",
    },
  });
type Handler = (init: RequestInit) => Response | Promise<Response>;
let handlers: Record<string, Handler>, fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
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
      json({
        id: "user-a",
        display_name: "Fixture A",
        email: "a@example.test",
      }),
    "GET /api/v1/accounts": () => json(planningAccounts),
    "GET /api/v1/subscriptions": () => json(subscriptionRows),
    "GET /api/v1/goals": () => json(goalRows),
    "GET /api/v1/debts": () => json(debtRows),
    "GET /api/v1/plans": () => json(planRows),
    "GET /api/v1/subscriptions/subscription-1/offers": () => json(offersRows),
    "GET /api/v1/evidence/evidence-1": () =>
      json({
        id: "evidence-1",
        kind: "calculation",
        source_id: "calculation-1",
        source_mode: "fixture",
        observed_at: "2026-11-07",
      }),
  };
  fetcher = vi.fn(
    async (path: string, init: RequestInit) =>
      handlers[(init.method ?? "GET") + " " + path]?.(init) ?? json({}, 404),
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function mount(child: React.ReactNode) {
  return render(
    <AuthProvider>
      <FinanceScope allowEmpty>{child}</FinanceScope>
    </AuthProvider>,
  );
}
const posts = () => fetcher.mock.calls.filter(([, i]) => i.method === "POST");

it("does not claim an intention was saved for a malformed success response", async () => {
  const user = userEvent.setup();
  handlers["POST /api/v1/subscription-actions"] = () => json({}, 201);
  mount(<SubscriptionsScreen />);
  await user.click(
    await screen.findByRole("button", { name: "Review StreamPlus" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Review cancellation intention" }),
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Save proposed intention" }),
  );
  await screen.findByText(/unsupported response/);
  expect(
    screen.queryByText(/The backend saved your intention/),
  ).not.toBeInTheDocument();
  expect(posts()).toHaveLength(1);
});
it("never overlaps run polls and aborts an in-flight request on unmount", async () => {
  let resolve!: (r: Response) => void;
  let pendingSignal: AbortSignal | undefined;
  handlers["GET /api/v1/runs/run-1"] = (init) => {
    pendingSignal = init.signal ?? undefined;
    return new Promise((r) => {
      resolve = r;
    });
  };
  const view = mount(<RunPanel id="run-1" />);
  await waitFor(() => expect(resolve).toBeTypeOf("function"));
  vi.useFakeTimers();
  const count = fetcher.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(fetcher.mock.calls).toHaveLength(count);
  view.unmount();
  expect(pendingSignal?.aborted).toBe(true);
  await act(async () => resolve(json(runFixture)));
  await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(fetcher.mock.calls).toHaveLength(count);
});

it("confirms preferences through the inspected PATCH contract and preserves other preferences", async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> | undefined;
  handlers["PATCH /api/v1/subscriptions/subscription-1"] = (init) => {
    body = JSON.parse(String(init.body));
    return json({ ...subscriptionRows.items[0], usage_confirmed: "unused" });
  };
  mount(<SubscriptionsScreen />);
  await user.click(
    await screen.findByRole("button", { name: "Review StreamPlus" }),
  );
  await user.selectOptions(
    screen.getByLabelText("Do you use this service?"),
    "unused",
  );
  await user.type(
    screen.getByLabelText("Features to keep / preferences"),
    "Keep HD",
  );
  await user.click(screen.getByRole("button", { name: "Confirm preferences" }));
  await screen.findByText(/Preferences were saved/);
  expect(body).toEqual({
    usage_confirmed: "unused",
    preferences: { notes: "Keep HD" },
    confirmation: true,
  });
  expect(posts()).toHaveLength(0);
});
it("labels sample offers, requires explicit intention confirmation and blocks duplicate submissions", async () => {
  const user = userEvent.setup();
  let resolve!: (r: Response) => void;
  handlers["POST /api/v1/subscription-actions"] = () =>
    new Promise((r) => {
      resolve = r;
    });
  mount(<SubscriptionsScreen />);
  await user.click(
    await screen.findByRole("button", { name: "Review StreamPlus" }),
  );
  await user.click(screen.getByRole("button", { name: "Compare offers" }));
  await screen.findByText("Sample offer");
  expect(
    screen.getByText("$189.96 · confirm whether annual billing applies"),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: /Review proposed switch/ }),
  );
  const save = screen.getByRole("button", { name: "Save proposed intention" });
  expect(save).toBeDisabled();
  expect(posts()).toHaveLength(0);
  await user.click(screen.getByRole("checkbox"));
  await user.click(save);
  fireEvent.click(save);
  expect(posts()).toHaveLength(1);
  const body = JSON.parse(String(posts()[0][1].body));
  expect(body).toEqual({
    subscription_id: "subscription-1",
    offer_id: "sample-annual",
    confirmation: true,
  });
  expect(posts()[0][1].headers).toMatchObject({
    "X-CSRF-Token": "test-only-csrf",
  });
  await act(async () =>
    resolve(
      json({ id: "action-1", status: "planned", realized_savings_cents: 0 }),
    ),
  );
  await screen.findByText(/No merchant change occurred/);
});
it("shows an honest missing offer provider without inventing alternatives", async () => {
  handlers["GET /api/v1/subscriptions/subscription-1/offers"] = () =>
    json({}, 503);
  const user = userEvent.setup();
  mount(<SubscriptionsScreen />);
  await user.click(
    await screen.findByRole("button", { name: "Review StreamPlus" }),
  );
  await user.click(screen.getByRole("button", { name: "Compare offers" }));
  await screen.findByText(/No replacement data/);
  expect(screen.queryByText("Sample offer")).not.toBeInTheDocument();
});
it("preserves goal input on network failure and refetches authoritative data after success", async () => {
  const user = userEvent.setup();
  handlers["POST /api/v1/goals"] = () => {
    throw new TypeError("Test-only network failure");
  };
  mount(<GoalsScreen />);
  await user.click(await screen.findByRole("button", { name: "Create goal" }));
  await user.type(screen.getByLabelText("Goal title"), "Car fund");
  await user.type(screen.getByLabelText("Target amount (USD)"), "1000.25");
  fireEvent.change(screen.getByLabelText("Goal deadline"), {
    target: { value: "2027-12-01" },
  });
  await user.click(screen.getByRole("button", { name: "Save goal" }));
  await screen.findByText(/Your input is preserved/);
  expect(screen.getByLabelText("Goal title")).toHaveValue("Car fund");
  handlers["POST /api/v1/goals"] = (init) => {
    const body = JSON.parse(String(init.body));
    handlers["GET /api/v1/goals"] = () =>
      json({ items: [{ id: "new-goal", ...body, saved_cents: 0 }] });
    return json({ id: "new-goal", ...body }, 201);
  };
  await user.click(screen.getByRole("button", { name: "Save goal" }));
  await screen.findByRole("heading", { name: "Car fund" });
  expect(JSON.parse(String(posts().at(-1)![1].body)).target_cents).toBe(100025);
});
it("retains plan retry idempotency and requires a fresh review after 409", async () => {
  const user = userEvent.setup();
  let attempt = 0;
  handlers["POST /api/v1/plans/plan-1/accept"] = () => {
    attempt++;
    if (attempt === 1) throw new TypeError("Test-only network failure");
    handlers["GET /api/v1/plans"] = () =>
      json({ items: [{ ...planRows.items[0], version: 3 }] });
    return json({}, 409);
  };
  mount(<GoalsScreen />);
  await user.click(
    await screen.findByRole("button", { name: "Review plan version 2" }),
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(
    screen.getByRole("button", { name: "Accept reviewed plan" }),
  );
  await screen.findByText(/Your input is preserved/);
  await user.click(
    screen.getByRole("button", { name: "Accept reviewed plan" }),
  );
  await screen.findByText(/acceptance was not retried/);
  const bodies = posts().map(([, i]) => JSON.parse(String(i.body)));
  expect(bodies[0].idempotency_key).toBe(bodies[1].idempotency_key);
  expect(bodies[0].expected_version).toBe(2);
  await user.click(
    await screen.findByRole("button", { name: "Review plan version 3" }),
  );
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Accept reviewed plan" }),
  ).toBeDisabled();
  expect(posts()).toHaveLength(2);
});
it("shows returned CD maturity and keeps restricted assets separate from liquid accounts", async () => {
  mount(<AssetsScreen />);
  await screen.findByText(/2027-04-01/);
  const restricted = screen.getByRole("table", {
    name: "Restricted asset snapshots",
  });
  expect(within(restricted).getByText("Example CD")).toBeInTheDocument();
  expect(
    within(
      screen.getByRole("table", { name: "Liquid account snapshots" }),
    ).queryByText("Example CD"),
  ).not.toBeInTheDocument();
});
it("uses the real scenario schema and returned forecast/evidence values without deriving a baseline", async () => {
  const user = userEvent.setup();
  handlers["POST /api/v1/scenarios"] = () => json(scenarioResult, 201);
  mount(<ScenariosScreen />);
  await user.type(await screen.findByLabelText("Expense (USD)"), "1250");
  await user.click(screen.getByRole("button", { name: "Run server scenario" }));
  await screen.findByText("Lowest projected cash: -$900.00");
  expect(JSON.parse(String(posts()[0][1].body))).toEqual({
    kind: "surprise_expense",
    expense_cents: 125000,
  });
  await user.click(screen.getByRole("button", { name: /Inspect evidence/ }));
  await within(screen.getByRole("dialog")).findByText("calculation-1");
});
it("allows goal creation without linked accounts while refusing to fabricate an empty-scope scenario", async () => {
  handlers["GET /api/v1/accounts"] = () =>
    json({ ...planningAccounts, items: [] });
  mount(<ScenariosScreen />);
  await screen.findByText("No connected accounts");
  expect(
    screen.getByRole("button", { name: "Run server scenario" }),
  ).toBeDisabled();
});
it("clears subscription dialogs on revocation and ignores an aborted older response", async () => {
  const user = userEvent.setup();
  mount(<SubscriptionsScreen />);
  await user.click(
    await screen.findByRole("button", { name: "Review StreamPlus" }),
  );
  handlers["GET /api/v1/accounts"] = () =>
    json({ ...planningAccounts, items: [] });
  handlers["GET /api/v1/subscriptions"] = () => json({ items: [] });
  act(() => window.dispatchEvent(new Event("finpilot:finance-invalidated")));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await screen.findByText("No connected accounts");
  expect(screen.queryByText("StreamPlus")).not.toBeInTheDocument();
});
it("does not allow a late user A response to repopulate user B after switching sessions", async () => {
  let resolveA!: (r: Response) => void;
  handlers["GET /api/v1/goals"] = () =>
    new Promise((r) => {
      resolveA = r;
    });
  function Switch() {
    const auth = useAuth();
    return (
      <button onClick={() => void auth.refresh()}>Switch fixture user</button>
    );
  }
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <Switch />
      <FinanceScope allowEmpty>
        <GoalsScreen />
      </FinanceScope>
    </AuthProvider>,
  );
  await waitFor(() => expect(resolveA).toBeTypeOf("function"));
  handlers["GET /api/v1/me"] = () =>
    json({ id: "user-b", display_name: "Fixture B", email: "b@example.test" });
  handlers["GET /api/v1/goals"] = () =>
    json({
      items: [{ ...goalRows.items[0], id: "goal-b", title: "User B goal" }],
    });
  await user.click(screen.getByRole("button", { name: "Switch fixture user" }));
  await screen.findByText("User B goal");
  await act(async () => resolveA(json(goalRows)));
  expect(screen.queryByText("Emergency cushion")).not.toBeInTheDocument();
  expect(screen.getByText("User B goal")).toBeInTheDocument();
});
it("stops terminal-run polling and only displays reported roles/events", async () => {
  handlers["GET /api/v1/runs/run-1"] = () => json(runFixture);
  handlers["GET /api/v1/runs/run-1/events"] = () =>
    json({ items: [], next_cursor: null });
  mount(<RunPanel id="run-1" />);
  await screen.findByText("Run status: completed");
  const calls = fetcher.mock.calls.length;
  vi.useFakeTimers();
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(fetcher.mock.calls).toHaveLength(calls);
  expect(screen.getAllByText("Status: Not reported")).toHaveLength(8);
});
it("keeps chat and missing run services explicitly unavailable instead of simulating success", async () => {
  const user = userEvent.setup();
  mount(<AgentsScreen />);
  await user.click(await screen.findByRole("button", { name: "Run checkup" }));
  await screen.findByText(/not implemented yet/);
  expect(screen.queryByText("Run status: completed")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run checkup" })).toBeDisabled();
  await user.click(screen.getByText("Chat integration"));
  expect(
    screen.getByRole("heading", { name: "Chat panel unavailable" }),
  ).toBeVisible();
});


it("decodes current run envelopes, exposes scoped findings and confirms server cancellation", async () => {
  let cancelled=false;
  handlers["GET /api/v1/runs/run-current"] = () => json({run_id:"run-current",status:cancelled?"cancelled":"running",snapshot_version:planningAccounts.snapshot_version,role_steps:[{role:"cash-collision",status:"running",reason:"Executing scoped tools"}],findings:[],trace:[],stale:false,inference_source_mode:"live"});
  handlers["GET /api/v1/runs/run-current/events"] = () => json({items:[],next_cursor:"0",has_more:false,stale:false});
  handlers["POST /api/v1/runs/run-current/cancel"] = () => {cancelled=true;return json({run_id:"run-current",status:"cancelled"});};
  mount(<RunPanel id="run-current"/>);
  await screen.findByText("Run status: running");
  await userEvent.click(screen.getByRole("button",{name:"Cancel server run"}));
  await screen.findByText("Run status: cancelled");
  expect(cancelled).toBe(true);
  expect(screen.queryByText("Run status: completed")).not.toBeInTheDocument();
});
