import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function DecisionControls() {
  return (
    <Card>
      <h2>Decision controls</h2>
      <p className="muted">
        Inspect the source, compare an alternative, then confirm your choice.
      </p>
      <Button variant="secondary" disabled>
        View supporting evidence
      </Button>
      <Button disabled>Ask FinPilot</Button>
      <p className="small muted">
        Evidence and chat are unavailable in this scaffold.
      </p>
    </Card>
  );
}
