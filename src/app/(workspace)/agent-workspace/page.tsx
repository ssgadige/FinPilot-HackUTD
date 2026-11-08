import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { AgentsScreen } from "@/components/planning/agents";
export default async function Page() {
  await requireVerifiedSession();
  return (
    <FinanceScope allowEmpty>
      <AgentsScreen />
    </FinanceScope>
  );
}
