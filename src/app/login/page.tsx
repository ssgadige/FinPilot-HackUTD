import { AuthFlow } from "@/components/auth/auth-flow";

export const metadata = { title: "Sign in" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <AuthFlow
      reason={
        reason === "expired" || reason === "unavailable" ? reason : undefined
      }
    />
  );
}
