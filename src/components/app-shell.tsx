"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { Bell, Menu, Navigation, PanelLeftClose, X } from "lucide-react";
import { navigation } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { LogoutButton } from "@/components/auth/logout-button";

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  function closeNavigation() {
    drawer.current?.close();
  }
  function navLinks(mobile = false) {
    return (
      <nav aria-label={mobile ? "Mobile navigation" : "Primary navigation"}>
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            aria-current={
              pathname === href || (pathname === "/" && href === "/overview")
                ? "page"
                : undefined
            }
            onClick={mobile ? closeNavigation : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        <div className="nav-divider" />
        <Link
          href="/ui"
          aria-current={pathname === "/ui" ? "page" : undefined}
          onClick={mobile ? closeNavigation : undefined}
        >
          <PanelLeftClose size={18} aria-hidden="true" />
          <span>Shared UI</span>
        </Link>
      </nav>
    );
  }
  const brand = (
    <>
      <Link
        href="/"
        className="brand"
        aria-label="FinPilot home"
        onClick={closeNavigation}
      >
        <Navigation size={25} aria-hidden="true" />
        finpilot<span className="brand-dot">.</span>
      </Link>
      <p className="brand-caption">Financial command center</p>
    </>
  );

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar">
        {brand}
        {navLinks()}
        <div className="sidebar-footer">
          <span className="simulation-dot" />
          Independent simulation<p>No real money movement</p>
        </div>
      </aside>
      <dialog
        ref={drawer}
        className="mobile-drawer"
        aria-labelledby="navigation-title"
        onClose={() => menuButton.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeNavigation();
        }}
      >
        <div className="drawer-content">
          <div className="drawer-heading">
            <h2 id="navigation-title">Navigation</h2>
            <Button
              variant="ghost"
              onClick={closeNavigation}
              aria-label="Close navigation"
            >
              <X size={22} />
            </Button>
          </div>
          {brand}
          {navLinks(true)}
          <p className="small">Simulation · No real money movement</p>
        </div>
      </dialog>
      <div className="app-content">
        <header className="workspace-bar">
          <button
            ref={menuButton}
            type="button"
            className="mobile-menu button button--ghost"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={23} />
          </button>
          <span className="mobile-section">
            {pathname === "/"
              ? "Command center"
              : pathname === "/ui"
                ? "Shared UI"
                : (navigation.find((item) => item.href === pathname)?.label ??
                  "Workspace")}
          </span>
          <div className="workspace-label">
            <span className="muted">Personal workspace</span>
            <span className="workspace-slash">/</span>
            <strong>
              {state.status === "authenticated"
                ? state.session.profile.display_name
                : "Session unresolved"}
            </strong>
          </div>
          <div className="workspace-status">
            <Badge tone="success">Simulated data</Badge>
            <span
              className="notification-status"
              title="Notifications unavailable in scaffold"
            >
              <Bell size={18} aria-hidden="true" />
              <span className="sr-only">
                Notifications unavailable in scaffold
              </span>
            </span>
            <span className="profile-avatar" aria-label="FinPilot profile">
              FP
            </span>
            <LogoutButton />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>FinPilot · Independent hackathon prototype</span>
          <span>
            Synthetic records only. Institution connections are simulated.
          </span>
        </footer>
      </div>
    </>
  );
}
