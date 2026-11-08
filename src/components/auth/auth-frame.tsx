import Link from "next/link";
import { Navigation } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <a className="skip-link" href="#auth-content">
        Skip to sign in
      </a>
      <aside className="auth-brand-panel" aria-label="FinPilot">
        <Link href="/login" className="brand">
          <Navigation size={25} aria-hidden="true" />
          finpilot<span className="brand-dot">.</span>
        </Link>
        <p className="brand-caption">Financial command center</p>
        <p className="auth-brand-note">
          Your financial picture.
          <br />A coordinated next move.
        </p>
        <p className="small auth-brand-footer">
          Independent hackathon prototype
          <br />
          No real money movement
        </p>
      </aside>
      <div className="auth-workspace">
        <header className="workspace-bar">
          <span>
            FinPilot <span className="muted">/ Sign in</span>
          </span>
          <Badge tone="success">Simulated data</Badge>
        </header>
        <main id="auth-content" className="auth-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          Use fictional FinPilot credentials only. Institution credentials are
          separate.
        </footer>
      </div>
    </div>
  );
}
