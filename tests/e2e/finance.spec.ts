import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import {
  accountsFixture,
  forecastFixture,
  olderTransactionsFixture,
  overviewFixture,
  transactionsFixture,
} from "../fixtures/finance";

// Test-only component harness. The Next server's deny-all guard is never replaced.
test.use({ baseURL: "http://127.0.0.1:3100" });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      headers: { "X-CSRF-Token": randomUUID() },
      json: {
        id: "test-person",
        display_name: "Test fixture person",
        email: "person@example.test",
      },
    }),
  );
  await page.route("**/api/v1/accounts", (route) =>
    route.fulfill({ json: accountsFixture }),
  );
  await page.route("**/api/v1/overview", (route) =>
    route.fulfill({ json: overviewFixture }),
  );
  await page.route("**/api/v1/forecast?*", (route) =>
    route.fulfill({ json: forecastFixture }),
  );
  await page.route("**/api/v1/transactions*", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).searchParams.has("cursor")
        ? olderTransactionsFixture
        : transactionsFixture,
    }),
  );
});
async function capture(page: Page, name: string, fullPage = true) {
  await expect(
    page.getByText(/Automated test fixture · not live integration/).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/tasks/FP-04/evidence/${name}.png`,
    fullPage,
  });
}
test("fixture overview and accounts at desktop/mobile preserve sources, investments and explained indicators", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#overview");
  await expect(page.getByText("$5,400.00", { exact: true })).toBeVisible();
  await expect(page.getByText("1.8 months", { exact: true })).toBeVisible();
  await expect(page.getByText("$21,400.00", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, "overview-fixture-1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "overview-fixture-390");
  await page.goto("/#accounts");
  await expect(
    page.getByRole("heading", { name: "Accounts with context" }),
  ).toBeVisible();
  await expect(page.getByText("$21,400.00", { exact: true })).toBeVisible();
  await capture(page, "accounts-fixture-390");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await capture(page, "accounts-fixture-1440");
});
test("fixture history filters, cursor navigation, evidence keyboard trap and focus restoration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#transactions");
  const opener = page.getByRole("button", { name: "Inspect Market Basket" });
  await expect(opener).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, "transactions-fixture-1440");
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Transaction evidence" });
  await expect(
    dialog.getByText("Market Basket", { exact: true }),
  ).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close evidence" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, "evidence-fixture-1440", false);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.getByLabel("Search transactions").fill("Market");
  await page.getByLabel("Account", { exact: true }).selectOption("checking");
  await page.getByLabel("From date").fill("2024-05-01");
  await expect(opener).toBeVisible();
  const next = page.waitForRequest((r) =>
    r.url().includes("cursor=older-page"),
  );
  await page.getByRole("button", { name: "Next page" }).click();
  const request = await next;
  expect(new URL(request.url()).searchParams.get("q")).toBe("Market");
  expect(new URL(request.url()).searchParams.get("account_id")).toBe(
    "checking",
  );
  await expect(
    page.getByText("Older history record", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search transactions").fill("new query");
  await expect(opener).toBeVisible();
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "transactions-fixture-390");
  await opener.click();
  await expect(
    dialog.getByText("Market Basket", { exact: true }),
  ).toBeVisible();
  await capture(page, "evidence-fixture-390", false);
});
test("fixture cash calendar has 30/90-day options, dated table and projected commitments", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#cash");
  await expect(
    page.getByText("Expected paycheck", { exact: true }),
  ).toBeVisible();
  await page.getByText("View chart data", { exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Dated projected balances" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, "cash-calendar-fixture-1440");
  const request = page.waitForRequest("**/api/v1/forecast?days=90");
  await page.getByLabel("Forecast horizon").selectOption("90");
  await request;
  await expect(
    page.getByText("Expected paycheck", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "cash-calendar-fixture-390");
});
test("fixture disconnect clears open evidence and financial history; absent endpoints remain unavailable", async ({
  page,
}) => {
  await page.goto("/#transactions");
  await page.getByRole("button", { name: "Inspect Market Basket" }).click();
  await expect(
    page.getByRole("dialog").getByText("Market Basket", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/v1/accounts", (route) =>
    route.fulfill({ json: { ...accountsFixture, items: [] } }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("finpilot:finance-invalidated")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("No connected accounts", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Market Basket", { exact: true })).toHaveCount(0);
  await capture(page, "disconnected-fixture-1280");
  await page.route("**/api/v1/accounts", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await page.reload();
  await expect(
    page.getByText(/No sample balances have been substituted/),
  ).toBeVisible();
  await capture(page, "unavailable-fixture-1280");
});
test("fixture session expiry clears records; a pending session never loads financial APIs", async ({
  page,
}) => {
  await page.route("**/api/v1/transactions*", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/#transactions");
  await expect(
    page.getByText("Sign in to continue", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Search transactions")).toHaveCount(0);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/me", async (route) => {
    await pending;
    await route.fulfill({ status: 401, json: {} });
  });
  const financeRequests: string[] = [];
  page.on("request", (r) => {
    if (/api\/v1\/(accounts|transactions|overview|forecast)/.test(r.url()))
      financeRequests.push(r.url());
  });
  await page.goto("/?pending-session#overview");
  await expect(
    page.getByText("Checking your session", { exact: true }),
  ).toBeVisible();
  expect(financeRequests).toEqual([]);
  release();
  await expect(
    page.getByText("Sign in to continue", { exact: true }),
  ).toBeVisible();
});
