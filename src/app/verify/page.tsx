import { redirect } from "next/navigation";
import { pageProfile } from "../../server/page-session";
import { AuthScreen } from "../../components/finpilot/auth";
export const dynamic = "force-dynamic";
export default async function Verify() {
  if (await pageProfile()) redirect("/overview");
  return <AuthScreen verify />;
}
