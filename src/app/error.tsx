"use client";

import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Card>
      <DataState
        state="error"
        title="This section could not load"
        action={<Button onClick={reset}>Try again</Button>}
      >
        Try loading the section again.
      </DataState>
    </Card>
  );
}
