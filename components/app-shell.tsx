"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/quotes", label: "Quotes" },
  { href: "/invoices", label: "Invoices" },
  { href: "/catalog", label: "Catalog" },
  { href: "/admin/settings", label: "Settings" },
];

/**
 * Sticky header + main area for every screen of the quote system.
 * The nav scrolls horizontally rather than wrapping, so it still fits a
 * 320px phone without pushing the content down.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/quotes" className="app-brand">
          <span className="app-brand__mark">AG</span>
          <span>Azarraga Glass</span>
        </Link>
        <nav className="app-nav">
          {LINKS.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/quotes" && pathname.startsWith(link.href)) ||
              (link.href === "/quotes" && pathname.startsWith("/quotes"));
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
