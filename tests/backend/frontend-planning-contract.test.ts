import { test } from "node:test";
import assert from "node:assert/strict";
import { application } from "./application";
import type { AccountSummary } from "../../contracts/types";
import { workspaceApi } from "../../src/lib/workspace-api";
import { connectionsApi } from "../../src/lib/connections-api";
test("FP-05/06: frontend DTOs accept real backend lists and scoped CD maturity without altering existing data", async (t) => {
  const app = await application();
  try {
    // Isolated generated fixture only: exercise the optional CD field on an authorized row.
    app.store.exec(
      "UPDATE accounts SET kind='cd',maturity_date='2027-04-01' WHERE id=? AND user_id=?",
      "demo-01-a1",
      "demo-01",
    );
    app.link();
    const accounts = await app.request("accounts");
    assert.equal(accounts.status, 200);
    assert.equal(
      accounts.data.items.find((a: AccountSummary) => a.id === "demo-01-a1")
        .maturity_date,
      "2027-04-01",
    );
    t.mock.method(
      globalThis,
      "fetch",
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        const path = String(input).replace("/api/v1/", "");
        const response = await app.request(
          path,
          init?.method ?? "GET",
          init?.body ? JSON.parse(String(init.body)) : undefined,
        );
        return Response.json(response.data, { status: response.status });
      },
    );
    const signal = new AbortController().signal;
    assert.ok((await connectionsApi.institutions()).length > 0);
    const subscriptions = await workspaceApi.subscriptions(signal);
    assert.ok(subscriptions.length);
    const subscription = subscriptions[0];
    const updated = await app.request(
      "subscriptions/" + subscription.id,
      "PATCH",
      {
        usage_confirmed: "unused",
        preferences: { notes: "Retain HD" },
        confirmation: true,
      },
    );
    assert.equal(updated.status, 200);
    const reread = await workspaceApi.subscriptions(signal);
    assert.equal(
      reread.find((s) => s.id === subscription.id)?.usage_confirmed,
      "unused",
    );
    assert.equal(
      reread.find((s) => s.id === subscription.id)?.preferences.notes,
      "Retain HD",
    );
    const receipt = await app.request("subscription-actions", "POST", {
      subscription_id: subscription.id,
      cancel_intention: true,
      confirmation: true,
    });
    assert.equal(receipt.status, 201);
    assert.equal(receipt.data.status, "planned");
    assert.equal(receipt.data.realized_savings_cents, 0);
    assert.equal(
      (await app.request("subscriptions/" + subscription.id + "/offers"))
        .status,
      503,
    );
    const created = await app.request("goals", "POST", {
      title: "Frontend contract goal",
      target_cents: 100000,
      deadline: "2027-12-01",
      priority: 2,
    });
    assert.equal(created.status, 201);
    assert.ok(
      (await workspaceApi.goals(signal)).some((g) => g.id === created.data.id),
    );
    assert.ok(
      (await workspaceApi.debts(signal)).every((d) =>
        accounts.data.items.some((a: AccountSummary) => a.id === d.id),
      ),
    );
    assert.deepEqual(await workspaceApi.plans(signal), []);
  } finally {
    app.close();
  }
});
