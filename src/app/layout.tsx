import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";
import "@/components/auth/auth.css";

export const metadata: Metadata = {
  title: {
    default: "FinPilot | Financial command center",
    template: "%s | FinPilot",
  },
  description:
    "FinPilot shared UI preview. A simulated financial command center using synthetic examples only.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
