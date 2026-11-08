import type { ReactNode } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
