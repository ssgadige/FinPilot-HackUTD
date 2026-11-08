"use client";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, MetricCard } from "@/components/ui/card";
import { FormField, SelectField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { useFinanceScope } from "@/components/finance/finance-scope";
import {
  EvidenceDrawer,
  type EvidenceRecord,
} from "@/components/finance/evidence-drawer";
import { usd } from "@/lib/finance-api";
import {
  workspaceApi,
  workspaceRequest,
  savedRecord,
  WorkspaceProblem,
  type Subscription,
} from "@/lib/workspace-api";
import type { Offer } from "../../../contracts/types";
import {
  ResourceState,
  useWorkspaceRead,
  useWorkspaceAction,
} from "./workspace-state";
import { Sources, Unlinked, SafetyNote } from "./shared";
import { ReviewDialog } from "./modal";

export function SubscriptionsScreen() {
  const { accounts } = useFinanceScope();
  const [selected, setSelected] = useState<Subscription | null>(null),
    [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const r = useWorkspaceRead("subscriptions", async (s) => {
    const page = await workspaceApi.subscriptionPage(s);
    const rows=page.items;
    if (rows.some((v) => !accounts.items.some((a) => a.id === v.account_id)))
      throw new WorkspaceProblem(403, "revoked");
    return page;
  });
  return (
    <div className="page-stack planning-page">
      <PageHeading
        title="Your recurring costs, made visible"
        description="Confirm what you use, inspect terms and choose a proposed next step."
      />
      <Sources />
      <div className="finance-metrics">
        <MetricCard
          label="Monthly recurring cost"
          value={usd(r.data?.summary?.monthly_equivalent_cents)}
          detail="Server-normalized detected recurring charges; missing or uncertain patterns remain unavailable."
        />
        <MetricCard
          label="Annual recurring cost"
          value={usd(r.data?.summary?.annual_recurring_cents)}
          detail="Server projection at latest known recurring prices, not realized charges or savings."
        />
        <MetricCard
          label="Usage confidence"
          value="Unknown"
          detail="Transaction history alone cannot establish that a service is unused."
        />
      </div>
      {!accounts.items.length ? (
        <Unlinked />
      ) : r.data ? (
        <div className="planning-grid">
          {r.data.items.length ? (
            r.data.items.map((v) => {
              const a = accounts.items.find((a) => a.id === v.account_id)!;
              return (
                <Card key={v.id}>
                  <div className="finance-toolbar">
                    <h2>{v.merchant}</h2>
                    <Badge>{v.status}</Badge>
                  </div>
                  <p className="planning-value">
                    {usd(v.amount_cents)}{" "}
                    <span className="small">/ {v.cadence}</span>
                  </p>
                  <p>
                    {a.label} · Usage: {v.usage_confirmed ?? "unknown"}
                  </p>
                  <p className="small muted">
                    {v.recurrence?`${v.recurrence.candidate?"Detected recurring pattern":"Uncertain pattern"} ? ${v.recurrence.charge_count} matching charges ? Latest ${v.recurrence.last_charge_date??"unknown"} ? Price increase ${usd(v.recurrence.price_increase_cents)}. This does not establish usage.`:"Recurrence confidence and price changes are unavailable; no supporting comparison evidence was returned."}
                  </p>
                  <div className="finance-actions">
                    <Button onClick={() => setSelected(v)}>
                      Review {v.merchant}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEvidence({ account: a })}
                    >
                      Inspect account
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card>
              <h2>No recurring candidates</h2>
              <p>
                Your connected accounts have no recurring candidates to review.
              </p>
            </Card>
          )}
        </div>
      ) : (
        <ResourceState {...r} />
      )}
      <SafetyNote />
      {selected && (
        <SubscriptionReview
          value={selected}
          onClose={() => setSelected(null)}
        />
      )}{" "}
      {evidence && (
        <EvidenceDrawer record={evidence} onClose={() => setEvidence(null)} />
      )}
    </div>
  );
}
function SubscriptionReview({
  value,
  onClose,
}: {
  value: Subscription;
  onClose: () => void;
}) {
  const { refresh } = useFinanceScope();
  const action = useWorkspaceAction();
  const [category,setCategory]=useState(typeof value.preferences.category==="string"?value.preferences.category:"");
  const [usage, setUsage] = useState(value.usage_confirmed ?? "unknown"),
    [notes, setNotes] = useState(
      typeof value.preferences.notes === "string"
        ? value.preferences.notes
        : "",
    ),
    [compare, setCompare] = useState(false),
    [intent, setIntent] = useState<{ offer?: Offer } | null>(null),
    [saved, setSaved] = useState(false);
  return (
    <ReviewDialog
      title={"Review " + value.merchant}
      onClose={() => {
        if (saved) refresh();
        onClose();
      }}
    >
      <div className="page-stack">
        <p>
          {usd(value.amount_cents)} / {value.cadence}. Charges establish a
          billing pattern, not whether you use the service.
        </p>
        <form
          className="planning-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              (s, csrf) =>
                workspaceRequest(
                  "subscriptions/" + encodeURIComponent(value.id),
                  s,
                  {
                    method: "PATCH",
                    body: {
                      usage_confirmed: usage,
                      preferences: { ...value.preferences, notes, ...(category?{category}:{}) },
                      confirmation: true,
                    },
                    csrf,
                  },
                ),
              (data) => {
                savedRecord(data, value.id);
                setSaved(true);
              },
            );
          }}
        >
          <SelectField
            label="Do you use this service?"
            value={usage}
            onChange={(e) => setUsage(e.target.value as typeof usage)}
          >
            <option value="used">Used</option>
            <option value="unused">Unused</option>
            <option value="unknown">Unknown</option>
          </SelectField>
          <SelectField label="Comparison category" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="">Unconfirmed</option><option value="music">Music subscription</option><option value="other">Other service</option>
          </SelectField>
          <p className="small muted">Choose music only for a music service. Available comparisons use the existing allowlisted provider; eligibility and feature equivalence still require review.</p>
          <FormField
            label="Features to keep / preferences"
            value={notes}
            maxLength={200}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button type="submit" disabled={action.busy || saved}>
            {action.busy
              ? "Saving…"
              : saved
                ? "Preferences saved"
                : "Confirm preferences"}
          </Button>
        </form>
        {saved && (
          <p role="status" className="planning-notice">
            Preferences were saved by FinPilot. Close this review to load the
            current snapshot.
          </p>
        )}
        {action.error && (
          <p role="alert" className="planning-error">
            {action.error}
          </p>
        )}
        <div className="finance-actions">
          <Button
            variant="secondary"
            disabled={saved}
            onClick={() => setCompare(true)}
          >
            Compare offers
          </Button>
          <Button
            variant="secondary"
            disabled={saved}
            onClick={() => setIntent({})}
          >
            Review cancellation intention
          </Button>
        </div>
        {compare && (
          <Offers id={value.id} choose={(offer) => setIntent({ offer })} />
        )}{" "}
        {intent && (
          <ActionReview
            subscription={value}
            offer={intent.offer}
            onClose={() => setIntent(null)}
            onSaved={() => setSaved(true)}
          />
        )}
      </div>
    </ReviewDialog>
  );
}
function Offers({
  id,
  choose,
}: {
  id: string;
  choose: (offer: Offer) => void;
}) {
  const r = useWorkspaceRead("offers:" + id, (s) => workspaceApi.offers(id, s));
  return (
    <section aria-label="Offer comparison">
      <h3>Compare the full cost</h3>
      <p>
        Promotions, renewal terms and annual upfront charges can outweigh a
        headline monthly price.
      </p>
      {r.data ? (
        r.data.length ? (
          <div className="page-stack">
            {r.data.map((o) => (
              <Card key={o.id}>
                <Badge
                  tone={o.source_mode === "fixture" ? "warning" : "neutral"}
                >
                  {o.source_mode === "fixture"
                    ? "Sample offer"
                    : o.source_mode === "cached"
                      ? "Cached offer"
                      : "Live source offer"}
                </Badge>
                <h3>
                  {o.provider} · {o.plan}
                </h3>
                <dl className="evidence-values">
                  <dt>Monthly equivalent</dt>
                  <dd>{usd(o.monthly_equivalent_cents)}</dd>
                  <dt>Upfront charge</dt>
                  <dd>
                    {usd(o.upfront_cents)} · confirm whether annual billing
                    applies
                  </dd>
                  <dt>Renewal charge</dt>
                  <dd>{usd(o.renewal_cents)}</dd>
                  <dt>Promotional price</dt>
                  <dd>{o.promotion?`${usd(o.promotion.price_cents)} for ${o.promotion.months} month(s). ${o.promotion.requires_new_customer?"New-customer eligibility required.":""} Availability and eligibility must be confirmed.`:"No confirmed promotional price supplied"}</dd>
                  <dt>Terms</dt><dd>{o.terms??"Terms unavailable"}</dd>
                  <dt>Promotion ends</dt>
                  <dd>{o.promo_end ?? "Unavailable"}</dd>
                  <dt>Eligibility</dt>
                  <dd>{o.eligibility.join("; ") || "Not supplied"}</dd>
                  <dt>Features</dt>
                  <dd>{o.features.join("; ") || "Not supplied"}</dd>
                  <dt>Retrieved / verified</dt>
                  <dd>{o.verified_at ?? "Unavailable"}</dd>
                  <dt>Source</dt>
                  <dd>
                    {o.source_url && /^https:\/\//.test(o.source_url) ? (
                      <a href={o.source_url} target="_blank" rel="noreferrer">
                        Provider source
                      </a>
                    ) : (
                      "Source URL unavailable"
                    )}
                  </dd>
                </dl>
                <Button onClick={() => choose(o)}>
                  Review proposed switch to {o.plan}
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <p>
            No comparable offers were returned. No alternative has been
            invented.
          </p>
        )
      ) : (
        <ResourceState {...r} />
      )}
    </section>
  );
}
function ActionReview({
  subscription,
  offer,
  onClose,
  onSaved,
}: {
  subscription: Subscription;
  offer?: Offer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const action = useWorkspaceAction();
  const [confirmed, setConfirmed] = useState(false),
    [receipt, setReceipt] = useState(false);
  return (
    <ReviewDialog title="Confirm a proposed intention" onClose={onClose}>
      <p>
        {offer
          ? `Propose switching ${subscription.merchant} to ${offer.plan}.`
          : `Record an intention to cancel ${subscription.merchant}.`}{" "}
        This saves an intention only. You must make any merchant change
        yourself.
      </p>
      <label className="planning-check">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={receipt || action.busy}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I confirm this proposed action. No purchase, cancellation or savings
        will be executed or realized.
      </label>
      <Button
        disabled={!confirmed || action.busy || receipt}
        onClick={() =>
          void action.run(
            (s, csrf) =>
              workspaceRequest("subscription-actions", s, {
                method: "POST",
                csrf,
                body: {
                  subscription_id: subscription.id,
                  ...(offer
                    ? { offer_id: offer.id }
                    : { cancel_intention: true }),
                  confirmation: true,
                },
              }),
            (data) => {
              savedRecord(data, undefined, "planned");
              setReceipt(true);
              onSaved();
            },
          )
        }
      >
        {receipt
          ? "Intention saved"
          : action.busy
            ? "Saving…"
            : "Save proposed intention"}
      </Button>
      {receipt && (
        <p role="status" className="planning-notice">
          The backend saved your intention. No merchant change occurred and no
          savings are counted as realized.
        </p>
      )}
      {action.error && <p role="alert">{action.error}</p>}
    </ReviewDialog>
  );
}
