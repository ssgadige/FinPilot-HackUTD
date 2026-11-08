import { requireVerifiedSession } from "@/server/auth/session";
import { InstitutionCatalog } from "@/components/connections/institution-catalog";

export const metadata = { title: "Institutions" };
export default async function InstitutionsPage() {
  await requireVerifiedSession();
  return <InstitutionCatalog />;
}
