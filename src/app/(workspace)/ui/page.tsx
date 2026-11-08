import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { PatternForm } from "./pattern-form";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DecisionControls } from "@/components/decision-controls";
import { requireVerifiedSession } from "@/server/auth/session";

const patterns = [
  { pattern: "Filters", behavior: "Preserve selected scope", state: "Active" },
  { pattern: "Evidence", behavior: "Open source drawer", state: "Read-only" },
  { pattern: "Pagination", behavior: "50 records per page", state: "Next" },
];

export const metadata = { title: "Shared UI" };

export default async function SharedUI() {
  await requireVerifiedSession();
  return (
    <div className="page-stack">
      <PageHeading
        title="Shared interaction patterns"
        description="Every page uses the same visual and behavior system."
        action={
          <div className="page-stack">
            <Button disabled aria-describedby="sign-in-unavailable">
              View sign in
            </Button>
            <p id="sign-in-unavailable" className="small muted">
              Sign-in is unavailable in this scaffold.
            </p>
          </div>
        }
      />
      <div className="preview-notice">
        <Badge>UI examples</Badge>
        <p>Try the form to inspect validation. Nothing is saved or sent.</p>
      </div>
      <div className="decision-grid">
        <div className="page-stack">
          <Card>
            <h2>Form fields — clear labels and units</h2>
            <PatternForm />
          </Card>
          <Card>
            <h2>Reusable data table</h2>
            <DataTable
              caption="Shared interaction pattern examples"
              rows={patterns}
              rowKey={(row) => row.pattern}
              columns={[
                {
                  key: "pattern",
                  label: "Pattern",
                  render: (row) => row.pattern,
                },
                {
                  key: "behavior",
                  label: "Behavior",
                  render: (row) => row.behavior,
                },
                { key: "state", label: "State", render: (row) => row.state },
              ]}
            />
          </Card>
        </div>
        <div className="page-stack">
          <Card className="pattern-loading">
            <h2>Loading</h2>
            <p className="muted">
              Skeletons preserve the layout while records load.
            </p>
            <div role="status" aria-label="Loading component example">
              <div className="skeleton" aria-hidden="true" />
            </div>
          </Card>
          <Card>
            <h2>Validation</h2>
            <p className="muted">
              Keep entered data; highlight the field with an actionable error.
            </p>
            <p className="small muted">
              Use “Validate example” to try the form.
            </p>
          </Card>
          <DecisionControls />
        </div>
      </div>
      <Card>
        <h2>Shared data states</h2>
        <p className="muted">
          These are component examples, not the state of a financial service.
        </p>
        <div className="field-grid">
          <DataState state="empty" title="No records example">
            Explain what belongs here and how to get started.
          </DataState>
          <DataState state="stale" title="Partial or stale example">
            Show the timestamp and affected records when connected.
          </DataState>
          <DataState state="success" title="Completion example">
            Announce the result after a confirmed operation.
          </DataState>
        </div>
        <div className="inline-actions">
          <Badge>Fixture data</Badge>
          <Badge tone="warning">Stale example</Badge>
          <Badge tone="success">UI ready</Badge>
        </div>
      </Card>
    </div>
  );
}
