import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <LoopMark />
            <span className="font-display text-lg font-semibold tracking-tight">Loop</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink to="/" active={pathname === "/"}>Home</NavLink>
            <NavLink to="/tree" active={pathname.startsWith("/tree")}>Skill tree</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={
        "rounded-md px-3 py-1.5 transition-colors " +
        (active ? "text-foreground bg-accent/60" : "text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </Link>
  );
}

function LoopMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="11" stroke="var(--primary)" strokeWidth="2.4" />
      <circle cx="16" cy="5.2" r="2.6" fill="var(--memory)" />
    </svg>
  );
}
