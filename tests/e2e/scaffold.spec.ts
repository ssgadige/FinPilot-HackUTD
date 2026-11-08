import { expect, test } from "@playwright/test";

// Real FP-10 validation denies unverified/expired sessions before financial rendering.
test("all workspace routes deny unauthenticated server access", async ({
  request,
}) => {
  const sections = [
    "/",
    "/overview",
    "/institutions",
    "/accounts",
    "/transactions",
    "/cash-and-bills",
    "/subscriptions",
    "/debt-and-readiness",
    "/goals-and-plans",
    "/assets",
    "/agent-workspace",
    "/scenario-lab",
    "/settings",
    "/ui",
  ];
  for (const path of sections) {
    const response = await request.get(path, { maxRedirects: 0 });
    const body = await response.text();
    expect([200, 307], path).toContain(response.status());
    if (response.status() === 307) {
      expect(response.headers().location, path).toBe("/login?reason=expired");
    } else {
      // Next.js may start streaming the loading boundary before emitting its redirect.
      expect(body, path).toContain("NEXT_REDIRECT");
      expect(body, path).toContain("/login?reason=expired");
    }
    expect(body, path).not.toContain("$5,400");
    expect(body, path).not.toContain("Planned card payment");
  }
});

test("client mocks and forged cookies cannot bypass the real server guard", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "fp_session",
      value: "untrusted-test-cookie",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      json: {
        id: "test",
        display_name: "Test user",
        email: "test@example.test",
      },
    }),
  );
  await page.goto("/accounts");
  await expect(page).toHaveURL(/\/login\?reason=expired/);
  await expect(page.getByRole("heading", { name: /signed in/i })).toBeVisible();
  // Even a forged successful /me response cannot authorize the server page.
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(page).toHaveURL(/\/login\?reason=expired/);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByText("$5,400")).toHaveCount(0);
});

test("financial routes stay closed without JavaScript; real backend APIs reject anonymous sessions", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login\?reason=expired/);
  await expect(page.getByText("$5,400")).toHaveCount(0);
  for (const path of [
    "/me",
    "/accounts",
    "/transactions",
    "/overview",
    "/forecast?days=30",
  ])
    expect((await request.get(`/api/v1${path}`)).status()).toBe(401);
  expect(
    (
      await request.post("/api/v1/auth/login", {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: { email: "test@example.test", password: "test-only-password" },
      })
    ).status(),
  ).toBe(401);
  await context.close();
});
