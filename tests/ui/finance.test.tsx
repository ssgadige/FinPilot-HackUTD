import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/auth-provider";
import { FinanceScope } from "@/components/finance/finance-scope";
import { TransactionsScreen } from "@/components/finance/transactions";
import { OverviewScreen } from "@/components/finance/overview";
import { CashScreen } from "@/components/finance/forecast";
import { financeApi, usd } from "@/lib/finance-api";
import {
  accountsFixture,
  forecastFixture,
  olderTransactionsFixture,
  overviewFixture,
  transactionsFixture,
} from "../fixtures/finance";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
type Handler = (url: URL, options: RequestInit) => Response | Promise<Response>;
let handlers: Record<string, Handler>;
let fetchMock: ReturnType<typeof vi.fn>;
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
    "/api/v1/me": () =>
      json({
        id: "test-person",
        display_name: "Fixture person",
        email: "person@example.test",
      }),
    "/api/v1/accounts": () => json(accountsFixture),
    "/api/v1/transactions": () => json(transactionsFixture),
    "/api/v1/overview": () => json(overviewFixture),
    "/api/v1/forecast": () => json(forecastFixture),
  };
  fetchMock = vi.fn(async (path: string, options: RequestInit) => {
    const url = new URL(path, "https://example.test");
    return handlers[url.pathname]?.(url, options) ?? json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(child = <TransactionsScreen />) {
  return render(
    <AuthProvider>
      <FinanceScope>{child}</FinanceScope>
    </AuthProvider>,
  );
}
async function history() {
  await screen.findByRole("button", { name: "Inspect Market Basket" });
}
const requests = () =>
  fetchMock.mock.calls
    .map(([path]) => new URL(path as string, "https://example.test"))
    .filter((u) => u.pathname.endsWith("/transactions"));

describe("financial history", () => {
  it("sends every filter, retains filters when paging, resets the cursor, and accepts 30-month and shorter history", async () => {
    handlers["/api/v1/transactions"] = (url) =>
      json(
        url.searchParams.has("cursor")
          ? olderTransactionsFixture
          : transactionsFixture,
      );
    const user = userEvent.setup();
    mount();
    await history();
    expect(requests()[0].search).toBe("");
    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "market" },
    });
    await waitFor(() =>
      expect(requests().at(-1)?.searchParams.get("q")).toBe("market"),
    );
    await user.selectOptions(screen.getByLabelText("Account"), "checking");
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2024-05-01" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-11-07" },
    });
    await history();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Older history record");
    expect(Object.fromEntries(requests().at(-1)!.searchParams)).toEqual({
      q: "market",
      account_id: "checking",
      category: "Groceries",
      from: "2024-05-01",
      to: "2026-11-07",
      cursor: "older-page",
    });
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await history();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("Older history record");
    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "short history" },
    });
    await history();
    expect(requests().at(-1)?.searchParams.has("cursor")).toBe(false);
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    handlers["/api/v1/transactions"] = () =>
      json({
        ...transactionsFixture,
        items: [transactionsFixture.items[0]],
        next_cursor: null,
      });
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await history();
    expect(requests().at(-1)?.search).toBe("");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
  it("ignores an older search response even when its transport ignores abort", async () => {
    let resolveOld!: (r: Response) => void;
    handlers["/api/v1/transactions"] = (url) =>
      url.searchParams.get("q") === "old"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : json({
            ...transactionsFixture,
            items: [
              { ...transactionsFixture.items[0], description: "New result" },
            ],
          });
    mount();
    await screen.findByText("New result");
    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "old" },
    });
    await waitFor(() => expect(resolveOld).toBeTypeOf("function"));
    expect(screen.queryByText("New result")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search transactions"), {
      target: { value: "new" },
    });
    await screen.findByText("New result");
    await act(async () =>
      resolveOld(
        json({
          ...transactionsFixture,
          items: [
            { ...transactionsFixture.items[0], description: "Stale result" },
          ],
        }),
      ),
    );
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
    expect(screen.getByText("New result")).toBeInTheDocument();
  });
  it("shows transfer, income, payment and pending charge classifications without inferring income from liability signs", async () => {
    mount();
    await history();
    const table = screen.getByRole("table", { name: "Transaction history" });
    expect(within(table).getByText("transfer")).toBeInTheDocument();
    expect(within(table).getByText("payment")).toBeInTheDocument();
    expect(within(table).getByText("income")).toBeInTheDocument();
    const cardRow = screen.getByText("StreamPlus").closest("tr")!;
    expect(within(cardRow).getByText("pending")).toBeInTheDocument();
    expect(within(cardRow).getByText("$18.99")).toBeInTheDocument();
    expect(within(cardRow).getByText("credit card")).toBeInTheDocument();
  });
  it("distinguishes connected accounts with no records from no filter matches", async () => {
    handlers["/api/v1/transactions"] = () =>
      json({ ...transactionsFixture, items: [], next_cursor: null });
    mount();
    await screen.findByText(
      "Connected accounts have no transaction records yet.",
    );
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "unknown" },
    });
    await screen.findByText("No transactions match these filters.");
  });
});

describe("overview and forecast integrity", () => {
  it("keeps investments separate and displays backend totals without summing transfer history", async () => {
    mount(<OverviewScreen />);
    await screen.findByText("$5,400.00");
    const investment = screen
      .getByRole("heading", { name: "Investments & restricted assets" })
      .closest("section")!;
    expect(within(investment).getByText("$21,400.00")).toBeInTheDocument();
    expect(screen.getByText("$17,600.00")).toBeInTheDocument();
    expect(screen.getByText("1.8 months")).toBeInTheDocument();
    expect(screen.getByText("18%")).toBeInTheDocument();
    expect(requests()).toHaveLength(0);
  });
  it("does not turn missing totals, missing units, zero denominator or missing limits into zero or healthy", async () => {
    handlers["/api/v1/overview"] = () =>
      json({
        ...overviewFixture,
        liquid_cash_cents: null,
        investments_cents: undefined,
        indicators: [
          { key: "cash_buffer_months", value: null },
          { ...overviewFixture.indicators![1], denominator_cents: 0 },
          {
            ...overviewFixture.indicators![2],
            missing_inputs: ["Card limit unavailable"],
          },
        ],
      });
    mount(<OverviewScreen />);
    await screen.findByText("$17,600.00");
    expect(screen.getAllByText("Unavailable")).toHaveLength(5);
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("32%")).not.toBeInTheDocument();
    expect(
      screen.queryByText("healthy", { exact: true }),
    ).not.toBeInTheDocument();
  });
  it("supports only 30/90 days, shows projected dates/table, account scope and low-cash assumptions", async () => {
    const user = userEvent.setup();
    mount(<CashScreen />);
    await screen.findByText("Expected paycheck");
    await user.selectOptions(screen.getByLabelText("Forecast horizon"), "90");
    await screen.findByText("Expected paycheck");
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/v1/forecast?days=90"),
    ).toBe(true);
    await user.click(screen.getByText("View chart data"));
    expect(
      screen.getByRole("table", { name: "Dated projected balances" }),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole("table", { name: "Dated projected balances" }),
      ).getByText("-$900.00"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Low cash means below zero/)).toBeInTheDocument();
  });
  it("retains available overview when forecast fails and offers an honest retry", async () => {
    handlers["/api/v1/forecast"] = () => json({}, 503);
    const user = userEvent.setup();
    mount(<OverviewScreen />);
    await screen.findByText(/No sample balances have been substituted/);
    expect(screen.getByText("$5,400.00")).toBeInTheDocument();
    handlers["/api/v1/forecast"] = () => json(forecastFixture);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Projected end-of-day balances");
  });
});

describe("authorization, evidence and failures", () => {
  it("shows no financial children or requests while authentication is pending", async () => {
    let resolveMe!: (r: Response) => void;
    handlers["/api/v1/me"] = () =>
      new Promise((resolve) => {
        resolveMe = resolve;
      });
    mount();
    expect(
      screen.queryByLabelText("Search transactions"),
    ).not.toBeInTheDocument();
    expect(fetchMock.mock.calls).toHaveLength(1);
    await act(async () =>
      resolveMe(
        json({
          id: "test-person",
          display_name: "Fixture",
          email: "person@example.test",
        }),
      ),
    );
    await history();
  });
  it("clears the drawer and history on disconnect, then requests fresh authorized scope", async () => {
    const user = userEvent.setup();
    mount();
    await history();
    await user.click(
      screen.getByRole("button", { name: "Inspect Market Basket" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Transaction evidence" });
    await within(dialog).findByText("Market Basket");
    handlers["/api/v1/accounts"] = () =>
      json({ ...accountsFixture, items: [] });
    act(() => window.dispatchEvent(new Event("finpilot:finance-invalidated")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Market Basket")).not.toBeInTheDocument();
    await screen.findByText("No connected accounts");
    expect(
      screen.getByRole("link", { name: "Go to Institutions" }),
    ).toHaveAttribute("href", "/institutions");
  });
  it("revalidates evidence, clears all data on revoked account and prevents stale requests from restoring it", async () => {
    const user = userEvent.setup();
    mount();
    await history();
    let resolveEvidence!: (r: Response) => void;
    handlers["/api/v1/accounts"] = () =>
      new Promise((resolve) => {
        resolveEvidence = resolve;
      });
    await user.click(
      screen.getByRole("button", { name: "Inspect Market Basket" }),
    );
    expect(screen.getByText("Checking evidence access")).toBeInTheDocument();
    await act(async () =>
      resolveEvidence(
        json({
          ...accountsFixture,
          items: accountsFixture.items.filter((a) => a.id !== "checking"),
        }),
      ),
    );
    await screen.findByText("Financial access changed");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Market Basket")).not.toBeInTheDocument();
  });
  it("supports Escape and restores focus to the evidence opener", async () => {
    const user = userEvent.setup();
    mount();
    await history();
    const opener = screen.getByRole("button", {
      name: "Inspect Market Basket",
    });
    await user.click(opener);
    await within(screen.getByRole("dialog")).findByText("Market Basket");
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
  it.each([401, 403, 409])(
    "clears all records on scope/session status %s",
    async (status) => {
      handlers["/api/v1/transactions"] = () => json({}, status);
      mount();
      await screen.findByText(
        status === 401
          ? "Financial access requires a verified session"
          : "Financial access changed",
      );
      expect(
        screen.queryByLabelText("Search transactions"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Market Basket")).not.toBeInTheDocument();
    },
  );
  it("rejects changed snapshot data instead of mixing it with old account scope", async () => {
    handlers["/api/v1/transactions"] = () =>
      json({ ...transactionsFixture, snapshot_version: 8 });
    mount();
    await screen.findByText(/financial snapshot changed/);
    expect(screen.queryByText("Market Basket")).not.toBeInTheDocument();
  });
  it("handles network failure, retry, rate limit and an unavailable contract without raw messages", async () => {
    handlers["/api/v1/transactions"] = () => {
      throw new TypeError("secret untrusted details");
    };
    const user = userEvent.setup();
    mount();
    await screen.findByText(/network request failed/);
    expect(
      screen.queryByText(/secret untrusted details/),
    ).not.toBeInTheDocument();
    handlers["/api/v1/transactions"] = () => json({}, 429);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Too many requests/);
    handlers["/api/v1/transactions"] = () =>
      json({ items: [], next_cursor: null });
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/schema is not yet supported/);
    handlers["/api/v1/transactions"] = () => json(transactionsFixture);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await history();
  });
  it("uses no-store same-origin GETs and rejects fractional cents", async () => {
    handlers["/api/v1/accounts"] = () =>
      json({
        ...accountsFixture,
        items: [{ ...accountsFixture.items[0], balance_cents: 1.5 }],
      });
    await expect(
      financeApi.accounts(new AbortController().signal),
    ).rejects.toMatchObject({ kind: "contract" });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
    handlers["/api/v1/accounts"] = () =>
      json({
        ...accountsFixture,
        items: [
          "checking",
          "savings",
          "credit_card",
          "brokerage",
          "ira",
          "cd",
          "auto_loan",
          "mortgage",
        ].map((kind) => ({ id: kind, label: `Example ${kind}`, kind })),
      });
    expect(
      (await financeApi.accounts(new AbortController().signal)).items,
    ).toHaveLength(8);
    expect(usd(undefined)).toBe("Unavailable");
    expect(usd(-1899)).toBe("-$18.99");
    expect(usd(0)).toBe("$0.00");
  });
  it("cannot restore an in-flight page after scope invalidation", async () => {
    let resolvePage!: (r: Response) => void;
    handlers["/api/v1/transactions"] = () =>
      new Promise((resolve) => {
        resolvePage = resolve;
      });
    mount();
    await waitFor(() => expect(resolvePage).toBeTypeOf("function"));
    handlers["/api/v1/accounts"] = () =>
      json({ ...accountsFixture, items: [] });
    act(() => window.dispatchEvent(new Event("finpilot:finance-invalidated")));
    await screen.findByText("No connected accounts");
    await act(async () => resolvePage(json(transactionsFixture)));
    expect(screen.queryByText("Market Basket")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Search transactions"),
    ).not.toBeInTheDocument();
  });
  it("does not display a transaction from outside the confirmed account scope", async () => {
    handlers["/api/v1/transactions"] = () =>
      json({
        ...transactionsFixture,
        items: [{ ...transactionsFixture.items[0], account_id: "revoked" }],
      });
    mount();
    await screen.findByText("Financial access changed");
    expect(screen.queryByText("Market Basket")).not.toBeInTheDocument();
  });
  it("keeps evidence hidden on a failed access recheck and retries before displaying it", async () => {
    const user = userEvent.setup();
    mount();
    await history();
    handlers["/api/v1/accounts"] = () => {
      throw new TypeError("Test network failure");
    };
    await user.click(
      screen.getByRole("button", { name: "Inspect Market Basket" }),
    );
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByText("Evidence unavailable");
    expect(within(dialog).queryByText("Market Basket")).not.toBeInTheDocument();
    handlers["/api/v1/accounts"] = () => json(accountsFixture);
    await user.click(
      within(dialog).getByRole("button", { name: "Retry evidence" }),
    );
    await within(dialog).findByText("Market Basket");
  });
});
