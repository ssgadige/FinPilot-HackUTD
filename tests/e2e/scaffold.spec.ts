import { expect, test } from "@playwright/test";

// FP-02 replaces the public FP-01 preview with a fail-closed workspace.
test("all workspace routes deny server access while FP-10 is missing", async ({
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
      expect(response.headers().location, path).toBe(
        "/login?reason=unavailable",
      );
    } else {
      // Next.js may start streaming the loading boundary before emitting its redirect.
      expect(body, path).toContain("NEXT_REDIRECT");
      expect(body, path).toContain("/login?reason=unavailable");
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
      name: "session",
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
  await expect(page).toHaveURL(/\/login\?reason=unavailable/);
  await expect(
    page.getByText(/financial workspace remains unavailable/i),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByText("$5,400")).toHaveCount(0);
});

test("financial routes stay closed without JavaScript; backend endpoints are absent", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/login\?reason=unavailable/);
  await expect(page.getByText("$5,400")).toHaveCount(0);
  for (const path of ["/me", "/accounts"])
    expect((await request.get(`/api/v1${path}`)).status()).toBe(404);
  expect(
    (
      await request.post("/api/v1/auth/login", {
        data: { email: "test@example.test", password: "test-only-password" },
      })
    ).status(),
  ).toBe(404);
  await context.close();
});
