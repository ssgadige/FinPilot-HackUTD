import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { CashScreen } from "@/components/finance/forecast";
export default async function CashPage() {
  await requireVerifiedSession();
  return (
    <FinanceScope>
      <CashScreen />
    </FinanceScope>
  );
}
