"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LogOut } from "lucide-react";

export type DashboardNavItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
};

export function DashboardShell({
  brand,
  subtitle,
  navItems,
  logoutAction,
  children,
}: {
  brand: React.ReactNode;
  subtitle?: React.ReactNode;
  navItems: DashboardNavItem[];
  logoutAction: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 sm:hidden">
        <div className="text-base font-semibold tracking-tight">{brand}</div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 text-neutral-300"
          aria-label="Меню"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Overlay for mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 sm:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 p-4 transition-transform duration-200 sm:static sm:z-auto sm:w-60 sm:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-1 px-2 text-lg font-semibold tracking-tight">{brand}</div>
        {subtitle && <p className="mb-6 px-2 text-xs text-neutral-500">{subtitle}</p>}

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-neutral-50"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-neutral-100"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </form>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pt-20 sm:p-8 sm:pt-8">{children}</main>
    </div>
  );
}
