import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { GoalsScreen } from "@/components/planning/goals-plans";
export default async function Page() {
  await requireVerifiedSession();
  return (
    <FinanceScope allowEmpty>
      <GoalsScreen />
    </FinanceScope>
  );
}
