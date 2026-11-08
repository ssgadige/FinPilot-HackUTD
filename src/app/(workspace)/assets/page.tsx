import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { AssetsScreen } from "@/components/planning/finance-pages";
export default async function Page() {
  await requireVerifiedSession();
  return (
    <FinanceScope allowEmpty>
      <AssetsScreen />
    </FinanceScope>
  );
}
