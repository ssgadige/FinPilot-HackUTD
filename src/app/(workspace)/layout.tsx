import type { ReactNode } from "react";
import { requireVerifiedSession } from "@/server/auth/session";
import { AppShell } from "@/components/app-shell";
import { WorkspaceGate } from "@/components/auth/workspace-gate";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireVerifiedSession();
  return (
    <WorkspaceGate>
      <AppShell>{children}</AppShell>
    </WorkspaceGate>
  );
}
