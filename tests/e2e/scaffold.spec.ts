import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("desktop shell, all section destinations, skip link, and shared patterns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your financial command center",
  );
  await expect(page.getByText("Simulated data", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("heading", { level: 1 }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/tasks/FP-01/evidence/desktop-1440.png",
    fullPage: true,
  });
  const nav = page.getByRole("navigation", {
    name: "Primary navigation",
    exact: true,
  });
  const sections = await nav
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href")!,
        label: link.textContent!,
      })),
    );
  expect(sections).toHaveLength(13);
  for (const section of sections) {
    await nav.getByRole("link", { name: section.label, exact: true }).click();
    await expect(page).toHaveURL(section.href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: section.label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("button", { name: "Validate example" }).click();
  await expect(page.getByLabel("Amount (USD)")).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "docs/tasks/FP-01/evidence/shared-ui-1440.png",
    fullPage: true,
  });
  await page.goto("/not-a-section");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});

test("mobile drawer contains focus, closes with Escape, navigates, and tables scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
  await expect(drawer).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await drawer.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(menu).toBeFocused();
  await menu.click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "docs/tasks/FP-01/evidence/mobile-navigation-390.png",
  });
  await drawer.getByRole("link", { name: "Accounts", exact: true }).click();
  await expect(page).toHaveURL("/accounts");
  await expect(drawer).not.toBeVisible();
  await menu.click();
  await drawer.getByRole("link", { name: "FinPilot home" }).click();
  await expect(page).toHaveURL("/");
  await expect(drawer).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const table = page.getByRole("region", { name: /Illustrative upcoming/ });
  expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  await table.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => table.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await table.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await page.getByRole("heading", { level: 1 }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/tasks/FP-01/evidence/mobile-390.png",
    fullPage: true,
  });
});

test("tablet rail, 200 percent equivalent layout, reduced motion and local asset", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Primary navigation", exact: true }),
  ).toBeVisible();
  const chart = page.locator(".reference-chart img");
  expect(
    await chart.evaluate((img) => (img as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  expect(await chart.getAttribute("src")).toBe(
    "/images/forecast-reference.svg",
  );
  await page.setViewportSize({ width: 720, height: 550 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/ui");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Shared interaction patterns",
  );
  expect(
    await page
      .locator(".field-grid .skeleton")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
