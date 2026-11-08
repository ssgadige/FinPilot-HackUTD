import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { AccountsScreen } from "@/components/finance/accounts";
export default async function AccountsPage() {
  await requireVerifiedSession();
  return (
    <FinanceScope>
      <AccountsScreen />
    </FinanceScope>
  );
}
