import type { Metadata } from "next";
import { requireVerifiedSession } from "@/server/auth/session";
import { PageHeading } from "@/components/page-heading";
import { CoachPanel } from "@/components/chat/coach-panel";
export const metadata: Metadata = { title: "Ask FinPilot" };
export default async function CoachPage() {
  await requireVerifiedSession();
  return <div className="page-stack">
    <PageHeading title="Ask about your next move" description="A conversation connected to your financial picture." />
    <CoachPanel />
  </div>;
}
