import type { Metadata } from "next";
import { requireVerifiedSession } from "@/server/auth/session";
import { AgentWorkspace } from "@/components/chat/agent-workspace";
export const metadata: Metadata = { title: "Financial team & coach" };
export default async function Page() {
  await requireVerifiedSession();
  return <AgentWorkspace />;
}
