import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";
import "@/components/auth/auth.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FinPilot | Financial command center",
    template: "%s | FinPilot",
  },
  description:
    "FinPilot shared UI preview. A simulated financial command center using synthetic examples only.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0c2d1a",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
