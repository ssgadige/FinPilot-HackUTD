import { test } from "node:test";
import assert from "node:assert/strict";
import { application } from "./application";
import { createApi } from "../../src/server/api";
import { financeApi } from "../../src/lib/finance-api";
import type { AccountsResponse } from "../../contracts/types";

test("accounts contract: empty, linked, filtered and revoked lists carry the actual user snapshot", async (t) => {
  const app = await application();
  try {
    app.store.exec(
      "UPDATE users SET snapshot_version=? WHERE id=?",
      37,
      "demo-01",
    );
    app.store.exec(
      "UPDATE users SET snapshot_version=? WHERE id=?",
      91,
      "demo-02",
    );
    const empty = await app.request("accounts");
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.data.items, []);
    assert.equal(
      empty.data.snapshot_version,
      app.store.user("demo-01").snapshot_version,
    );
    assert.equal(empty.data.source_mode, "fixture");
    assert.equal(empty.data.as_of, app.finance.asOf());
    assert.equal(
      (await app.request("accounts", "GET", undefined, 1)).data
        .snapshot_version,
      91,
    );

    // Feed the real endpoint output through the unchanged frontend decoder.
    let response: AccountsResponse = empty.data;
    t.mock.method(globalThis, "fetch", async () => Response.json(response));
    assert.deepEqual(
      (await financeApi.accounts(new AbortController().signal)).items,
      [],
    );

    // Only isolated test fixtures are linked. No existing demo records are changed.
    const connections = app.link();
    const linked = await app.request("accounts");
    assert.ok(linked.data.items.length > 0);
    assert.equal(
      linked.data.snapshot_version,
      app.store.user("demo-01").snapshot_version,
    );
    assert.notEqual(linked.data.snapshot_version, empty.data.snapshot_version);
    response = linked.data;
    assert.equal(
      (await financeApi.accounts(new AbortController().signal)).items.length,
      linked.data.items.length,
    );

    const institution = linked.data.items[0].institution_id;
    const filtered = await app.request(
      "accounts?institution_id=" + encodeURIComponent(institution),
    );
    assert.ok(
      (filtered.data as AccountsResponse).items.every(
        (a) => a.institution_id === institution,
      ),
    );
    assert.equal(filtered.data.snapshot_version, linked.data.snapshot_version);
    const noMatches = await app.request(
      "accounts?institution_id=not-a-linked-institution",
    );
    assert.deepEqual(noMatches.data.items, []);
    assert.equal(noMatches.data.snapshot_version, linked.data.snapshot_version);
    assert.deepEqual(
      (await app.request("accounts", "GET", undefined, 1)).data.items,
      [],
    );
    assert.equal(
      (await app.request("accounts", "GET", undefined, 1)).data
        .snapshot_version,
      91,
    );

    app.store.exec(
      "UPDATE connections SET last_sync_at=NULL WHERE user_id=?",
      "demo-01",
    );
    response = (await app.request("accounts")).data;
    assert.ok(response.items.every((a) => !Object.hasOwn(a, "last_sync_at")));
    assert.equal(
      (await financeApi.accounts(new AbortController().signal)).items.length,
      response.items.length,
    );

    for (const connection of connections)
      app.simulator.revoke("demo-01", connection.id);
    const disconnected = await app.request("accounts");
    assert.deepEqual(disconnected.data.items, []);
    assert.equal(
      disconnected.data.snapshot_version,
      app.store.user("demo-01").snapshot_version,
    );
    assert.ok(
      disconnected.data.snapshot_version > linked.data.snapshot_version,
    );
    response = disconnected.data;
    assert.deepEqual(
      (await financeApi.accounts(new AbortController().signal)).items,
      [],
    );
    const denied = await createApi(app.services)(
      new Request("http://localhost:3000/api/v1/accounts"),
    );
    assert.equal(denied.status, 401);
  } finally {
    app.close();
  }
});
