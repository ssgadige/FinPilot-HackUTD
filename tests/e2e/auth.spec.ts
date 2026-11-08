import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("real missing-backend login is honest, accessible and responsive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Sign-in service is unavailable",
  );
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to sign in" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.getByRole("heading", { name: "Welcome back" }).click();
  await page.evaluate(() => scrollTo(0, 0));
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "docs/tasks/FP-02/evidence/login-unavailable-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/tasks/FP-02/evidence/login-unavailable-390.png",
    fullPage: true,
  });
  await page.getByLabel("Email", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login(?:#auth-content)?$/);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "unavailable",
  );
});

test("test-only challenge fixtures show verification, wrong/expired codes and cooldown", async ({
  page,
}) => {
  // These fixtures are confined to tests. There is no application mock mode.
  await page.clock.install();
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "UNAUTHENTICATED" } },
    }),
  );
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 202,
      json: {
        challenge_id: "test-challenge",
        masked_email: "t***@example.test",
      },
    }),
  );
  let verifyCode = "INVALID_CODE";
  await page.route("**/api/v1/auth/verify", (route) =>
    route.fulfill({ status: 400, json: { error: { code: verifyCode } } }),
  );
  let resends = 0;
  await page.route("**/api/v1/auth/resend", (route) => {
    resends++;
    return route.fulfill({ status: 202, json: {} });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("/login/verify");
  await expect(
    page.getByRole("heading", { name: "Check your email", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/t\*\*\*@example.test/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("heading", { level: 1 }).click();
  await page.screenshot({
    path: "docs/tasks/FP-02/evidence/verification-fixture-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/tasks/FP-02/evidence/verification-fixture-390.png",
    fullPage: true,
  });
  await page.getByLabel("Email code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "That code could not be verified" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email code")).toHaveValue("");
  verifyCode = "CODE_EXPIRED";
  await page.getByLabel("Email code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "That code has expired",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "docs/tasks/FP-02/evidence/expired-code-fixture-390.png",
    fullPage: true,
  });
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: "Request new code" }).click();
  await expect(page.getByText(/A new code was requested/)).toBeVisible();
  expect(resends).toBe(1);
  await expect(page.getByRole("button", { name: /Resend in/ })).toBeDisabled();
  await page.getByRole("button", { name: /Change email/ }).click();
  await expect(page).toHaveURL("/login");
  await page.goto("/login/verify");
  await expect(
    page.getByRole("heading", { name: "Sign in to request a code" }),
  ).toBeVisible();
});

test("network failure preserves input; checking never shows financial content", async ({
  page,
}) => {
  let resolveMe!: () => void;
  await page.route("**/api/v1/me", async (route) => {
    await new Promise<void>((resolve) => {
      resolveMe = resolve;
    });
    await route.fulfill({ status: 401, json: {} });
  });
  await page.goto("/login");
  await expect(page.getByText("Checking your session")).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByText("$5,400")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);
  resolveMe();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.route("**/api/v1/auth/login", (route) => route.abort("failed"));
  await page.getByLabel("Email", { exact: true }).fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Check your connection",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "test@example.test",
  );
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
});

test("logout failure keeps the session; confirmed revocation returns to login", async ({
  page,
}) => {
  let revoked = false;
  let acceptLogout = false;
  await page.route("**/api/v1/me", (route) =>
    route.fulfill(
      revoked
        ? { status: 401, json: {} }
        : {
            status: 200,
            headers: { "X-CSRF-Token": "test-csrf" },
            json: {
              id: "test",
              display_name: "Test user",
              email: "test@example.test",
            },
          },
    ),
  );
  await page.route("**/api/v1/auth/logout", (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("test-csrf");
    if (!acceptLogout) return route.abort("failed");
    revoked = true;
    return route.fulfill({ status: 204 });
  });
  await page.goto("/login/verify");
  await expect(
    page.getByRole("heading", { name: "You’re signed in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Sign-out has not been confirmed",
  );
  await expect(page).toHaveURL("/login/verify");
  acceptLogout = true;
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
