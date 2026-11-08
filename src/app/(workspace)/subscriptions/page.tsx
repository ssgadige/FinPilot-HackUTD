import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { SubscriptionsScreen } from "@/components/planning/subscriptions";
export default async function Page() {
  await requireVerifiedSession();
  return (
    <FinanceScope allowEmpty>
      <SubscriptionsScreen />
    </FinanceScope>
  );
}
