import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";

export default function Loading() {
  return (
    <Card>
      <DataState state="loading" title="Loading workspace">
        Preparing this section.
      </DataState>
    </Card>
  );
}
