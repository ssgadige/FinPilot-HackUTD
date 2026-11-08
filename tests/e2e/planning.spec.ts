import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  planningAccounts,
  subscriptionRows,
  goalRows,
  debtRows,
  offersRows,
  planRows,
  scenarioResult,
} from "../fixtures/planning";
test.use({ baseURL: "http://127.0.0.1:3100" });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/me", (r) =>
    r.fulfill({
      headers: { "X-CSRF-Token": "test-only-csrf" },
      json: {
        id: "fixture-user",
        display_name: "Test fixture person",
        email: "fixture@example.test",
      },
    }),
  );
  for (const [path, json] of Object.entries({
    accounts: planningAccounts,
    subscriptions: subscriptionRows,
    goals: goalRows,
    debts: debtRows,
    plans: planRows,
  }))
    await page.route("**/api/v1/" + path, (r) => r.fulfill({ json }));
  await page.route("**/api/v1/subscriptions/subscription-1/offers", (r) =>
    r.fulfill({ json: offersRows }),
  );
});
async function capture(
  page: Page,
  task: string,
  name: string,
  fullPage = true,
) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/tasks/${task}/evidence/${name}.png`,
    fullPage,
  });
}
for (const [mode, task, title] of [
  ["subscriptions", "FP-05", "Your recurring costs, made visible"],
  ["debts", "FP-06", "Give every payment a purpose"],
  ["goals", "FP-06", "Your priorities, coordinated"],
  ["assets", "FP-06", "Assets, with their limitations"],
  ["scenarios", "FP-06", "Rehearse the unexpected"],
  ["agents", "FP-07", "Your financial team, with visible evidence"],
]) {
  test(`labeled fixture ${mode} is accessible at desktop and mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/#" + mode);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    if (mode === "subscriptions")
      await expect(
        page.getByRole("button", { name: "Review StreamPlus" }),
      ).toBeVisible();
    if (mode === "goals")
      await expect(
        page.getByText("Emergency cushion", { exact: true }),
      ).toBeVisible();
    if (mode === "debts")
      await expect(page.getByText("$3,600.00", { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await capture(page, task, `${mode}-fixture-1440`);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, task, `${mode}-fixture-390`);
  });
}
test("offer and intention dialogs keep real controls, confirmation and keyboard containment", async ({
  page,
}) => {
  await page.goto("/#subscriptions");
  await page.getByRole("button", { name: "Review StreamPlus" }).click();
  await page.getByRole("button", { name: "Compare offers" }).click();
  await expect(page.getByText("Sample offer", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await capture(page, "FP-05", "offers-fixture-1440", false);
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "FP-05", "offers-fixture-390", false);
  await page.getByRole("button", { name: /Review proposed switch/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Confirm a proposed intention",
  });
  const save = dialog.getByRole("button", { name: "Save proposed intention" });
  await expect(save).toBeDisabled();
  await dialog.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((n) => n.contains(document.activeElement))).toBe(
    true,
  );
  await capture(page, "FP-05", "intention-confirmation-fixture-390", false);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Review proposed switch/ }),
  ).toBeFocused();
});
test("goal editing, stale-plan review and scenario evidence states are explicit", async ({
  page,
}) => {
  await page.goto("/#goals");
  await page.getByRole("button", { name: "Edit Emergency cushion" }).click();
  await expect(page.getByLabel("Goal title")).toHaveValue("Emergency cushion");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "FP-06", "goal-editor-fixture-390", false);
  await page.keyboard.press("Escape");
  await page.route("**/api/v1/plans/plan-1/accept", async (r) => {
    await page.route("**/api/v1/plans", (r) =>
      r.fulfill({ json: { items: [{ ...planRows.items[0], version: 3 }] } }),
    );
    await r.fulfill({
      status: 409,
      json: { error: { code: "version_conflict" } },
    });
  });
  await page.getByRole("button", { name: "Review plan version 2" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Accept reviewed plan" }).click();
  await expect(page.getByText(/acceptance was not retried/)).toBeVisible();
  await capture(page, "FP-06", "stale-plan-fixture-390");
  await page.goto("/#scenarios");
  await page.route("**/api/v1/scenarios", (r) =>
    r.fulfill({ json: scenarioResult, status: 201 }),
  );
  await page.getByLabel("Expense (USD)").fill("1250");
  await page.getByRole("button", { name: "Run server scenario" }).click();
  await expect(page.getByText("Lowest projected cash: -$900.00")).toBeVisible();
  await page.getByText("View chart data", { exact: true }).click();
  await capture(page, "FP-06", "scenario-result-fixture-390");
});
test("empty, missing service and revocation states have no stale financial records", async ({
  page,
}) => {
  await page.route("**/api/v1/accounts", (r) =>
    r.fulfill({ json: { ...planningAccounts, items: [] } }),
  );
  await page.goto("/#subscriptions");
  await expect(
    page.getByText("No connected accounts", { exact: true }),
  ).toBeVisible();
  await capture(page, "FP-08", "unlinked-fixture-1280");
  await page.route("**/api/v1/accounts", (r) =>
    r.fulfill({ json: planningAccounts }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Review StreamPlus" }).click();
  await page.route("**/api/v1/subscriptions/subscription-1/offers", (r) =>
    r.fulfill({ status: 503, json: {} }),
  );
  await page.getByRole("button", { name: "Compare offers" }).click();
  await expect(page.getByText(/No replacement data/)).toBeVisible();
  await capture(page, "FP-08", "offers-unavailable-fixture-1280", false);
  await page.route("**/api/v1/accounts", (r) =>
    r.fulfill({ json: { ...planningAccounts, items: [] } }),
  );
  await page.route("**/api/v1/subscriptions", (r) =>
    r.fulfill({ json: { items: [] } }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("finpilot:finance-invalidated")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("StreamPlus", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("No connected accounts", { exact: true }),
  ).toBeVisible();
});
