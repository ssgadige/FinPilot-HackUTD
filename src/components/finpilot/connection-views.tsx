"use client";
import { useState, type FormEvent } from "react";
import {
  api,
  money,
  newKey,
  titleCase,
  type Account,
  type Institution,
  type Subscription,
} from "../../lib/finpilot";
import { useResource, useWorkspace } from "./context";
import { Card, Empty, Icon, Loading, Modal, Notice, useAction } from "./ui";
export function Institutions() {
  const { institutions, connections, refresh, notify } = useWorkspace();
  const [category, setCategory] = useState("all"),
    [selected, setSelected] = useState<Institution | null>(null),
    [preview, setPreview] = useState<{
      preview_token: string;
      accounts: Account[];
    } | null>(null),
    [selection, setSelection] = useState<string[]>([]),
    [confirmation, setConfirmation] = useState(false);
  const action = useAction();
  const categories = ["all", ...new Set(institutions.map((i) => i.category))];
  const close = () => {
    setSelected(null);
    setPreview(null);
    setSelection([]);
    setConfirmation(false);
    action.clear();
  };
  const login = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    void action.run(async () => {
      const p = await api<{ preview_token: string; accounts: Account[] }>(
        "connections/preview",
        "POST",
        {
          institution_id: selected!.id,
          demo_username: String(data.get("username")),
          demo_password: String(data.get("password")),
        },
      );
      form.reset();
      setPreview(p);
      setSelection(
        p.accounts
          .filter((a) => !connections.some((c) => c.account_ids.includes(a.id)))
          .map((a) => a.id),
      );
    });
  };
  return (
    <>
      <Notice>
        Simulation only. These connections use generated demo credentials and
        never contact a real bank.
      </Notice>
      <div className="section-toolbar">
        <div className="segmented scrollable" aria-label="Institution category">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "selected" : ""}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c === "all" ? "All institutions" : titleCase(c)}
            </button>
          ))}
        </div>
        <span className="small muted">
          {connections.length} active connections
        </span>
      </div>
      <div className="institution-grid">
        {institutions
          .filter((i) => category === "all" || i.category === category)
          .map((i) => {
            const linked = connections.some((c) => c.institution_id === i.id);
            return (
              <Card key={i.id} className="institution-card">
                <div className="institution-card-top">
                  <span className={`institution-logo provider-${i.id}`}>
                    {i.name
                      .split(" ")
                      .filter((w) => !["of", "the"].includes(w))
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="subtle-tag">{titleCase(i.category)}</span>
                </div>
                <h2>{i.name}</h2>
                <p>
                  Simulated{" "}
                  {i.category === "cards"
                    ? "credit card"
                    : i.category === "investments"
                      ? "investment"
                      : "financial"}{" "}
                  connection
                </p>
                <div className="institution-card-bottom">
                  {linked ? (
                    <span className="positive small">
                      <Icon name="check" size={14} /> Connected
                    </span>
                  ) : (
                    <span className="muted small">
                      Choose your account access
                    </span>
                  )}
                  <button
                    className="button secondary compact"
                    onClick={() => {
                      setSelected(i);
                      setPreview(null);
                      action.clear();
                    }}
                  >
                    {linked ? "Add accounts" : "Connect"}
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
      </div>
      {selected && (
        <Modal
          title={
            preview
              ? "Choose the accounts to connect"
              : `Connect ${selected.name}`
          }
          onClose={close}
          busy={action.busy}
        >
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <Notice tone="warning">
            Fake login only. Use your generated {selected.name} demo username
            and password. Never use real institution credentials.
          </Notice>
          {!preview ? (
            <form className="form-stack" onSubmit={login}>
              <label>
                Demo username
                <input
                  name="username"
                  autoComplete="off"
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Demo institution password
                <input
                  name="password"
                  type="password"
                  autoComplete="off"
                  maxLength={256}
                  required
                />
              </label>
              <button className="button full" disabled={action.busy}>
                {action.busy
                  ? "Checking credentials…"
                  : "Preview owned accounts"}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api("connections", "POST", {
                    preview_token: preview.preview_token,
                    account_ids: selection,
                    consent_version: "v1",
                    idempotency_key: action.key({
                      preview: preview.preview_token,
                      selection,
                    }),
                  });
                  close();
                  notify("Your selected accounts are connected.");
                  refresh();
                });
              }}
            >
              <p className="muted">
                Grant read access to balances, transaction history and known
                scheduled items for the accounts you select.
              </p>
              <div className="account-options">
                {preview.accounts.map((a) => {
                  const already = connections.some((c) =>
                    c.account_ids.includes(a.id),
                  );
                  return (
                    <label
                      className={`checkbox-card ${already ? "disabled" : ""}`}
                      key={a.id}
                    >
                      <input
                        type="checkbox"
                        checked={selection.includes(a.id) && !already}
                        disabled={already || action.busy}
                        onChange={(e) =>
                          setSelection((s) =>
                            e.target.checked
                              ? [...s, a.id]
                              : s.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <div>
                        <strong>{a.label}</strong>
                        <span>
                          •••• {a.last_four} ·{" "}
                          {already ? "Already connected" : titleCase(a.kind)}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmation}
                  onChange={(e) => setConfirmation(e.target.checked)}
                  required
                />
                I consent to access for my selected accounts (consent v1).
              </label>
              <button
                className="button full"
                disabled={
                  action.busy ||
                  !selection.filter(
                    (id) =>
                      !connections.some((c) => c.account_ids.includes(id)),
                  ).length ||
                  !confirmation
                }
                type="submit"
              >
                {action.busy ? "Connecting…" : "Connect selected accounts"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
export function Settings() {
  const { profile, connections, accounts, institutions, refresh, notify } =
    useWorkspace();
  const [disconnect, setDisconnect] = useState<string | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const action = useAction();
  const connection = connections.find((c) => c.id === disconnect);
  return (
    <div className="content-grid">
      <div className="content-column">
        <Card title="Profile and session">
          <div className="detail-list">
            <span>
              Display name<strong>{profile.display_name}</strong>
            </span>
            <span>
              Email<strong>{profile.email}</strong>
            </span>
            <span>
              Email verification<strong>Required at every sign in</strong>
            </span>
            <span>
              Workspace<strong>Simulation only</strong>
            </span>
            <span>
              Session<strong>Protected server cookie</strong>
            </span>
          </div>
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api("auth/logout", "POST", {});
                window.location.assign("/sign-in");
              })
            }
          >
            <Icon name="logout" size={16} />
            Sign out
          </button>
        </Card>
        <Card title="Connected institutions">
          {action.error && !disconnect && (
            <Notice tone="error">{action.error}</Notice>
          )}
          {connections.length ? (
            <div className="connection-list">
              {connections.map((c) => (
                <div className="connection-row" key={c.id}>
                  <div>
                    <strong>
                      {institutions.find((i) => i.id === c.institution_id)
                        ?.name || c.institution_id}
                    </strong>
                    <span className="muted small">
                      {c.account_ids.length} selected accounts · Last sync{" "}
                      {c.last_sync_at
                        ? new Date(c.last_sync_at).toLocaleString("en-US")
                        : "Not synced"}
                    </span>
                  </div>
                  <div className="button-row">
                    <button
                      className="text-button"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          await api(`connections/${c.id}/sync`, "POST", {
                            idempotency_key: action.key({ sync: c.id }),
                          });
                          notify(
                            "Synchronization complete. Fixture ledger preserved without duplicates.",
                          );
                          refresh();
                        })
                      }
                    >
                      <Icon name="refresh" size={15} />
                      Sync
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => {
                        setDisconnect(c.id);
                        setConfirmed(false);
                        action.clear();
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </Card>
      </div>
      <aside className="inspector">
        <Card title="You control access">
          <p>
            Disconnecting revokes FinPilot access without closing an institution
            account. Dependent evidence and plans become stale.
          </p>
        </Card>
        <Card title="Security changes">
          <p>
            Email and credential changes require reauthentication and are
            outside this prototype’s scope.
          </p>
        </Card>
      </aside>
      {connection && (
        <Modal
          title={`Disconnect ${institutions.find((i) => i.id === connection.institution_id)?.name || "institution"}?`}
          onClose={() => setDisconnect(null)}
          busy={action.busy}
        >
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <p className="muted">
            Balance and history access will be revoked for these accounts.
          </p>
          <ul className="assumption-list">
            {accounts
              .filter((a) => connection.account_ids.includes(a.id))
              .map((a) => (
                <li key={a.id}>
                  {titleCase(a.kind)} · •••• {a.last_four}
                </li>
              ))}
          </ul>
          <Notice tone="warning">
            Dependent findings and plans become stale. Reconnect and rerun your
            checkup before using those results.
          </Notice>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api(`connections/${connection.id}`, "DELETE", {
                  confirmation: true,
                });
                setDisconnect(null);
                notify(
                  "Institution access revoked. Dependent data is now stale.",
                );
                refresh();
              });
            }}
            className="form-stack"
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
              />
              I understand this revokes access and makes dependent results
              stale.
            </label>
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                disabled={action.busy}
                onClick={() => setDisconnect(null)}
              >
                Keep connection
              </button>
              <button
                className="button danger"
                disabled={!confirmed || action.busy}
              >
                {action.busy ? "Disconnecting…" : "Confirm disconnect"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Subscriptions() {
  const { accounts, notify, refresh } = useWorkspace();
  const result = useResource<{ items: Subscription[] }>("subscriptions");
  const [editing, setEditing] = useState<Subscription | null>(null),
    [cancel, setCancel] = useState<Subscription | null>(null),
    [offers, setOffers] = useState<Subscription | null>(null);
  const action = useAction();
  if (!accounts.length) return <Empty />;
  return (
    <>
      {action.error && !editing && !cancel && (
        <Notice tone="error">{action.error}</Notice>
      )}
      <div className="content-grid">
        <div className="content-column">
          <Card
            title="Recurring candidates"
            action={
              <span className="subtle-tag">USER CONFIRMATION REQUIRED</span>
            }
          >
            {result.loading ? (
              <Loading />
            ) : result.error ? (
              <Notice tone="error">{result.error}</Notice>
            ) : result.data!.items.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Cadence</th>
                      <th className="number">Charge</th>
                      <th>Usage</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.data!.items.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="stack">
                            <strong>{s.merchant}</strong>
                            <span className="small muted">
                              {titleCase(s.status)}
                            </span>
                          </div>
                        </td>
                        <td>{titleCase(s.cadence)}</td>
                        <td className="number">{money(s.amount_cents)}</td>
                        <td>
                          <span className="category-tag">
                            {s.usage_confirmed
                              ? titleCase(s.usage_confirmed)
                              : "Not confirmed"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => {
                              setEditing(s);
                              action.clear();
                            }}
                          >
                            Review
                            <Icon name="arrow" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No recurring candidates yet"
                text="Link a card or account with recurring charges to review subscriptions."
              />
            )}
          </Card>
          <Notice>
            Payment history cannot tell us whether you still use a service.
            Confirm what matters before comparing a change.
          </Notice>
        </div>
        <aside className="inspector">
          <Card title="Savings you can trust">
            <ol className="numbered-list">
              <li>Confirm usage and essential features</li>
              <li>Compare complete offer terms</li>
              <li>Save a proposed action</li>
            </ol>
            <p>Planned changes are never counted as realized savings.</p>
          </Card>
        </aside>
      </div>
      {editing && (
        <Modal
          title="Tell us what you want to keep"
          onClose={() => setEditing(null)}
          busy={action.busy}
        >
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <h3>
            {editing.merchant}{" "}
            <span className="muted small">
              · {money(editing.amount_cents)} / {editing.cadence}
            </span>
          </h3>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void action.run(async () => {
                await api(`subscriptions/${editing.id}`, "PATCH", {
                  usage_confirmed: String(data.get("usage")),
                  preferences: {
                    features: String(data.get("features")),
                    billing: String(data.get("billing")),
                    switching: String(data.get("switching")),
                  },
                  confirmation: true,
                });
                setEditing(null);
                notify("Your subscription preferences were saved.");
                refresh();
                result.reload();
              });
            }}
          >
            <label>
              Still using it?
              <select
                name="usage"
                defaultValue={editing.usage_confirmed || "unknown"}
              >
                <option value="unknown">Not sure yet</option>
                <option value="used">Yes, I use it</option>
                <option value="unused">No, I don’t use it</option>
              </select>
            </label>
            <label>
              Features to keep
              <input
                name="features"
                maxLength={200}
                placeholder="e.g. ad-free, HD, two screens"
                defaultValue={
                  JSON.parse(editing.preferences_json).features || ""
                }
              />
            </label>
            <label>
              Billing preference
              <select
                name="billing"
                defaultValue={
                  JSON.parse(editing.preferences_json).billing || "monthly"
                }
              >
                <option value="monthly">Monthly only</option>
                <option value="annual">Annual if affordable</option>
              </select>
            </label>
            <label>
              Switching preference
              <select
                name="switching"
                defaultValue={
                  JSON.parse(editing.preferences_json).switching || "same"
                }
              >
                <option value="same">Same provider</option>
                <option value="equivalent">Equivalent alternatives</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" required />I confirm these usage and
              preference details.
            </label>
            <button className="button" disabled={action.busy}>
              {action.busy ? "Saving…" : "Save preferences"}
            </button>
          </form>
          <div className="modal-secondary-actions">
            <button
              className="text-button"
              onClick={() => {
                setOffers(editing);
                setEditing(null);
              }}
            >
              Compare compatible offers <Icon name="arrow" size={14} />
            </button>
            <button
              className="text-button danger-text"
              onClick={() => {
                setCancel(editing);
                setEditing(null);
                action.clear();
              }}
            >
              Review cancellation intention
            </button>
          </div>
        </Modal>
      )}
      {offers && (
        <OfferDialog subscription={offers} close={() => setOffers(null)} />
      )}{" "}
      {cancel && (
        <Modal
          title="Review your subscription action"
          onClose={() => setCancel(null)}
          busy={action.busy}
        >
          {action.error && <Notice tone="error">{action.error}</Notice>}
          <div className="detail-list">
            <span>
              Service<strong>{cancel.merchant}</strong>
            </span>
            <span>
              Intention<strong>Review cancellation with provider</strong>
            </span>
            <span>
              Realized savings<strong>{money(0)}</strong>
            </span>
          </div>
          <Notice>
            This saves an intention only. Complete any cancellation directly
            with your provider.
          </Notice>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api("subscription-actions", "POST", {
                  subscription_id: cancel.id,
                  cancel_intention: true,
                  confirmation: true,
                });
                setCancel(null);
                notify(
                  "Cancellation intention saved as planned. No service was cancelled and no realized savings were recorded.",
                );
              });
            }}
          >
            <label className="checkbox-label">
              <input type="checkbox" required />I understand this saves a
              proposal only.
            </label>
            <button className="button" disabled={action.busy}>
              Save planned intention
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function OfferDialog({
  subscription,
  close,
}: {
  subscription: Subscription;
  close: () => void;
}) {
  const result = useResource<{
    items: {
      id: string;
      provider: string;
      plan: string;
      monthly_equivalent_cents: number;
      source_mode: string;
    }[];
  }>(`subscriptions/${subscription.id}/offers`);
  return (
    <Modal title="Compare the full cost" onClose={close}>
      <p className="muted">Compatible offers for {subscription.merchant}</p>
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <Notice tone="warning">
          Offer comparison is currently unavailable. No verified offer or
          savings estimate has been substituted.
        </Notice>
      ) : result.data?.items.length ? (
        result.data.items.map((o) => (
          <Card key={o.id} title={o.plan}>
            <p>
              {o.provider} · {o.source_mode}
            </p>
            <strong>
              {money(o.monthly_equivalent_cents)} / month equivalent
            </strong>
          </Card>
        ))
      ) : (
        <p>No comparable offers returned.</p>
      )}
      <button className="button secondary" onClick={result.reload}>
        Try again
      </button>
    </Modal>
  );
}
