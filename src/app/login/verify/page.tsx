import { AuthFlow } from "@/components/auth/auth-flow";

export const metadata = { title: "Check your email" };
export default function VerifyPage() {
  return <AuthFlow verification />;
}
