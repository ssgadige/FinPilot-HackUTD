import { PageHeading } from "@/components/page-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataState } from "@/components/ui/data-state";
import { PatternForm } from "./pattern-form";

export const metadata = { title: "Shared UI" };

export default function SharedUI() {
  return (
    <div className="page-stack">
      <PageHeading
        title="Shared interaction patterns"
        description="Every page uses the same visual and behavior system."
      />
      <div className="preview-notice">
        <Badge>UI examples</Badge>
        <p>Try the form to inspect validation. Nothing is saved or sent.</p>
      </div>
      <div className="decision-grid">
        <Card>
          <h2>Form fields — clear labels and units</h2>
          <PatternForm />
        </Card>
        <Card>
          <h2>Source and status labels</h2>
          <p className="muted">
            Text and icons communicate status alongside color.
          </p>
          <div className="inline-actions">
            <Badge>Fixture data</Badge>
            <Badge tone="warning">Stale example</Badge>
            <Badge tone="success">UI ready</Badge>
          </div>
        </Card>
      </div>
      <Card>
        <h2>Shared data states</h2>
        <p className="muted">
          These are component examples, not the state of a financial service.
        </p>
        <div className="field-grid">
          <DataState state="loading" title="Loading example">
            Skeletons preserve space while records load.
          </DataState>
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
      </Card>
    </div>
  );
}
