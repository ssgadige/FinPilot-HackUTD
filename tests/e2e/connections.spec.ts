import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { providerFixtures } from "../fixtures/institutions";

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
  await page.route("**/api/v1/connections", route=>route.fulfill({json:{items:[]}}));
  await page.route("**/api/v1/accounts", route=>route.fulfill({json:{items:[],snapshot_version:1,source_mode:"fixture",as_of:"2026-01-01"}}));
  await page.route("**/api/v1/institutions", (route) =>
    route.fulfill({ json: providerFixtures }),
  );
});
async function screenshot(page: Page, name: string, fullPage = true) {
  await page.screenshot({
    path: `docs/tasks/FP-03/evidence/${name}.png`,
    fullPage,
  });
}

test("test-only provider catalog, categories and search match the shared visual system", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Connect your financial picture",
  );
  for (const name of ["PNC", "Bank of America", "Chase"])
    await expect(
      page.getByRole("button", { name: `Connect ${name}` }),
    ).toBeVisible();
  await expect(
    page.getByText(/Automated test fixture · not live integration/),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await screenshot(page, "catalog-fixture-1440");
  await page.getByLabel("Search providers").fill("america");
  await expect(
    page.getByRole("button", { name: "Connect Bank of America" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect PNC" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /^Wallets/ }).click();
  await expect(
    page.getByRole("button", { name: "Connect PayPal" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Banks/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await screenshot(page, "catalog-fixture-390");
});

test("test-only provider dialog clears secrets and cannot expose account selection before institution OTP", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const connect = page.getByRole("button", { name: "Connect Chase" });
  await connect.click();
  const dialog = page.getByRole("dialog", { name: "Connect Chase" });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Simulation only. Do not enter real banking credentials."),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await screenshot(page, "simulator-login-fixture-390", false);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(connect).toBeFocused();
  await connect.click();
  let release!: () => void;
  let requests = 0;
  await page.route("**/api/v1/connections/preview", async (route) => {
    requests++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      json: {
        preview_token: randomUUID(),
        masked_email: "p***@example.test",
        challenge_id: randomUUID(),
        accounts: [{ label: "Forbidden premature account" }],
      },
    });
  });
  await page
    .getByLabel("Demo email or username")
    .fill("generated.person@example.test");
  await page.getByLabel("Generated institution password").fill(randomUUID());
  await page
    .getByRole("button", { name: "Continue to institution verification" })
    .click();
  await expect(page.getByLabel("Demo email or username")).toHaveValue("");
  await expect(page.getByLabel("Generated institution password")).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("button", { name: "Contacting simulator…" }),
  ).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(
    page.getByText("Verify your institution email"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Connect Chase" }),
  ).toBeInViewport();
  await expect(page.getByLabel("Institution email code")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Verify institution email" }),
  ).toBeEnabled();
  await expect(page.getByText("Forbidden premature account")).toHaveCount(0);
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await screenshot(
    page,
    "institution-verification-fixture-390",
    false,
  );
  await page.goto("http://127.0.0.1:3000/institutions");
  await expect(page).toHaveURL(/\/login\?reason=expired/);
  await expect(
    page.getByRole("heading", { name: "Connect your financial picture" }),
  ).toHaveCount(0);
});

test("test-only post-verification consent sends only selected scope and preserves the retry key", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#consent");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Choose the accounts to connect",
  );
  await expect(
    page.getByRole("checkbox", { name: /^I authorize/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Connect selected accounts" }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await screenshot(page, "consent-fixture-1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, "consent-fixture-390");
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/connections", (route) => {
    const data = route.request().postDataJSON();
    bodies.push(data);
    if (bodies.length === 1) return route.abort("failed");
    return route.fulfill({
      json: {
        connection: {
          id: "test-linked",
          institution_id: "chase",
          status: "active",
          account_ids: data.account_ids,
          last_sync_at: null,
        },
      },
    });
  });
  await page.getByRole("checkbox", { name: /^Example checking/ }).check();
  await page.getByRole("checkbox", { name: /^I authorize/ }).check();
  await page.getByRole("button", { name: "Connect selected accounts" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Check your connection",
  );
  await page.getByRole("button", { name: "Retry same link request" }).click();
  await expect(page.getByText("Connected · server confirmed")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[0].account_ids).toEqual(["test-checking"]);
  await expect(page.getByText("Example savings")).toHaveCount(0);
});

test("test-only sync failure and confirmed disconnect refresh preserve truthful status", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#connection");
  const keys: string[] = [];
  await page.route("**/api/v1/connections/test-connection/sync", (route) => {
    keys.push(route.request().postDataJSON().idempotency_key);
    return keys.length === 1
      ? route.abort("failed")
      : route.fulfill({ json: { snapshot_version: 2 } });
  });
  await page.getByRole("button", { name: "Sync records" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Check your connection",
  );
  await screenshot(page, "sync-failure-fixture-390");
  await page.getByRole("button", { name: "Retry same sync request" }).click();
  await expect(page.getByText("Sync confirmed", { exact: true })).toBeVisible();
  expect(keys[0]).toBe(keys[1]);
  let accountsRefresh = 0;
  let overviewRefresh = 0;
  await page.route("**/api/v1/accounts", (route) => {
    accountsRefresh++;
    return route.fulfill({ json: [] });
  });
  await page.route("**/api/v1/overview", (route) => {
    overviewRefresh++;
    return route.abort("failed");
  });
  await page.route("**/api/v1/connections/test-connection", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm disconnect" }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("checkbox", { name: /^I confirm/ }).check();
  await page.getByRole("button", { name: "Confirm disconnect" }).click();
  await expect(page.getByText("Disconnected", { exact: true })).toBeVisible();
  await expect(page.getByText("Example checking")).toHaveCount(0);
  await expect(
    page.getByText("Updated financial data unavailable"),
  ).toBeVisible();
  expect(accountsRefresh).toBe(1);
  expect(overviewRefresh).toBe(1);
  await screenshot(page, "disconnected-fixture-390");
});
