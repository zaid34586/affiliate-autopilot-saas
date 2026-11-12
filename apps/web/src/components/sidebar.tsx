"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MAIN_NAV, BOTTOM_NAV } from "@/lib/nav";
import { logout } from "@/app/(auth)/actions";

type Props = {
  user: { name?: string | null; email?: string | null };
  workspace: { name: string; plan: string };
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const renderItem = (item: (typeof MAIN_NAV)[number]) => {
    const active =
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-ink-3 text-bone"
            : "text-bone-2 hover:bg-ink-2 hover:text-bone"
        }`}
      >
        <span
          className={`label ${active ? "text-signal" : "text-bone-3 group-hover:text-bone-2"}`}
        >
          {item.index}
        </span>
        <span className="font-medium">{item.label}</span>
        {active && <span className="status-dot ml-auto bg-signal" />}
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5">
      <p className="label mb-2 px-3 text-bone-3">Modules</p>
      {MAIN_NAV.map(renderItem)}
      <div className="my-4 h-px bg-ink-3" />
      {BOTTOM_NAV.map(renderItem)}
    </nav>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={`label rounded-lg border border-ink-4 px-3 py-2 text-bone-3 transition-colors hover:border-danger/60 hover:text-danger ${
          compact ? "" : "w-full"
        }`}
      >
        Log out
      </button>
    </form>
  );
}

export function Sidebar({ user, workspace }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = (user.name || user.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("");

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-3 bg-ink-2/60 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2 pt-1">
          <span className="status-dot bg-signal pulse-slow" />
          <span className="label text-bone">Affiliate Autopilot</span>
        </div>

        {/* workspace chip */}
        <div className="mb-5 flex items-center justify-between rounded-lg border border-ink-3 bg-ink-2 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{workspace.name}</p>
            <p className="label text-bone-3">workspace</p>
          </div>
          <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">
            {workspace.plan}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>

        {/* autopilot status */}
        <div className="mt-4 rounded-lg border border-ink-3 bg-ink-2 px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="status-dot bg-amber pulse-slow" />
            <span className="label text-amber">Autopilot · standby</span>
          </div>
          <p className="mt-1.5 text-xs text-bone-3">
            Scheduler Phase 5 mein live hoga.
          </p>
        </div>

        {/* user block */}
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-ink-3 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal text-xs font-bold text-ink">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {user.name || user.email}
            </p>
            <p className="label truncate text-bone-3">{user.email}</p>
          </div>
        </div>
        <div className="mt-2">
          <LogoutButton />
        </div>
      </aside>

      {/* ── Mobile top strip ── */}
      <div className="sticky top-0 z-40 border-b border-ink-3 bg-ink/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="status-dot bg-signal pulse-slow" />
            <span className="label text-bone">Affiliate Autopilot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="label rounded border border-signal/40 bg-signal/10 px-1.5 py-0.5 text-signal">
              {workspace.plan}
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="label rounded-lg border border-ink-4 px-2.5 py-1.5 text-bone-2"
              aria-label="Toggle menu"
            >
              {mobileOpen ? "Close" : "Menu"}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-ink-3 px-3 pb-4 pt-3">
            <NavList onNavigate={() => setMobileOpen(false)} />
            <div className="mt-4">
              <LogoutButton compact />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
