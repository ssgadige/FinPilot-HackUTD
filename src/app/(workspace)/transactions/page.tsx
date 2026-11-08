import { requireVerifiedSession } from "@/server/auth/session";
import { FinanceScope } from "@/components/finance/finance-scope";
import { TransactionsScreen } from "@/components/finance/transactions";
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account_id?: string }>;
}) {
  await requireVerifiedSession();
  const params = await searchParams;
  return (
    <FinanceScope>
      <TransactionsScreen
        initialAccount={
          typeof params.account_id === "string" ? params.account_id : ""
        }
      />
    </FinanceScope>
  );
}
