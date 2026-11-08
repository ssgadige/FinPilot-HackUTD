import { notFound, redirect } from "next/navigation";
import { pageProfile } from "../../../server/page-session";
import { Workspace } from "../../../components/finpilot/workspace";
export const dynamic = "force-dynamic";
const screens = [
  "overview",
  "institutions",
  "accounts",
  "transactions",
  "cash",
  "subscriptions",
  "debt",
  "goals",
  "assets",
  "agents",
  "scenarios",
  "settings",
  "chat",
  "calculators",
];
export default async function Page({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!screens.includes(screen)) notFound();
  const profile = await pageProfile();
  if (!profile) redirect("/sign-in");
  return <Workspace key={profile.id} screen={screen} profile={profile} />;
}
