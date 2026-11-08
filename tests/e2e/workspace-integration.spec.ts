import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { planningAccounts } from "../fixtures/planning";
test.use({ baseURL: "http://127.0.0.1:3100" });
test("combined workspace hands off real references without implicit inference and remains accessible", async ({ page }) => {
  let chats = 0;
  await page.route("**/api/v1/me", r => r.fulfill({ headers: { "X-CSRF-Token": "fixture-csrf" }, json: { id: "fixture-a", display_name: "Fixture person", email: "fixture@example.test" } }));
  await page.route("**/api/v1/accounts", r => r.fulfill({ json: planningAccounts }));
  await page.route("**/api/v1/runs/owned**", r => r.fulfill({ json: r.request().url().includes("/events") ? { items: [], next_cursor: "0", has_more: false, stale: false } : { run_id: "owned", status: "completed", snapshot_version: planningAccounts.snapshot_version, stale: false, role_steps: [{ role: "cash-collision", status: "completed" }], findings: [{ id: "finding", summary: "A supported browser-fixture cash finding.", severity: "warning", evidence_ids: ["calc-owned"] }], inference_source_mode: "cached" } }));
  await page.route("**/api/v1/chat", r => { chats++; expect(r.request().postDataJSON().message).toBe("Explain the current finding supported by evidence calc-owned."); return r.fulfill({ json: { reply: "Browser fixture explanation; not live inference.", evidence_ids: ["calc-owned"], requested_run_id: null, conversation_id: "owned-chat", source_mode: "fixture", inference_source_mode: "cached" } }); });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/#integrated");
  await expect(page.getByRole("heading", { name: "Your financial team, with visible evidence" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: "docs/tasks/CHAT-INTEGRATION/evidence/specialists-fixture-1440.png", fullPage: true });
  await page.getByLabel("Existing authorized run ID").fill("owned");
  await page.getByRole("button", { name: "Inspect run availability" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Explain finding", exact: true }).click();
  await expect(page.getByLabel("Ask FinPilot")).toHaveValue("Explain the current finding supported by evidence calc-owned.");
  expect(chats).toBe(0);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Browser fixture explanation; not live inference.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Specialist team", exact: true }).click();
  await page.getByRole("button", { name: "Ask FinPilot", exact: true }).click();
  await expect(page.getByText("Browser fixture explanation; not live inference.", { exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `docs/tasks/CHAT-INTEGRATION/evidence/coach-fixture-${width}.png`, fullPage: true });
  }
  expect(chats).toBe(1);
});
