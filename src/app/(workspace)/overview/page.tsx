import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { OverviewScreen } from "@/components/finance/overview";
export default async function OverviewPage() {
  await requireVerifiedSession();
  return (
    <FinanceScope>
      <OverviewScreen />
    </FinanceScope>
  );
}
