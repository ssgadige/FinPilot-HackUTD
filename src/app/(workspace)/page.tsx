import { redirect } from "next/navigation";
import { requireVerifiedSession } from "@/server/auth/session";
export default async function HomePage() {
  await requireVerifiedSession();
  redirect("/overview");
}
