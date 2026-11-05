"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { OWNER_NAVIGATION, ownerSection, type CatalogView } from "@/lib/navigation";
import { ProductFinder } from "@/components/product-finder";


/**
 * Sticky header + main area for every screen of the quote system.
 * The nav scrolls horizontally rather than wrapping, so it still fits a
 * 320px phone without pushing the content down.
 */
export function AppShell({ children, wide = false, catalogScreen = "catalog" }: { children: ReactNode; wide?: boolean; catalogScreen?: CatalogView }) {
  const pathname = usePathname();
  const shellRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const topbar = topbarRef.current;
    if (!shell || !topbar) return;
    const measure = () => shell.style.setProperty("--app-topbar-height", `${topbar.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(topbar);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="document-shell" ref={shellRef}>
      <div className="document-topbar" ref={topbarRef}>
      <header className="document-header no-print">
        <Link href="/quotes" className="app-brand">
          <img src="/azarraga-logo-full.jpg" alt="Azarraga Glass & Aluminum" width={170} height={44} style={{ objectFit: "contain", background: "#fff", borderRadius: 4, padding: 4 }} />
        </Link>
        <nav className="app-nav" aria-label="Main navigation">
          {OWNER_NAVIGATION.map((link) => {
            const active = ownerSection(pathname, catalogScreen) === link.id;
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <ProductFinder/>
      </div>
      {process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_PREVIEW === "1" && (
        <div className="inline-note no-print" role="status" style={{ borderRadius: 0, textAlign: "center" }}>
          Layout preview · sample quotes and invoices · changes are not saved
        </div>
      )}
      {process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_MEMORY === "1" && (
        <div className="inline-note no-print" role="status" style={{ borderRadius: 0, textAlign: "center" }}>Development workspace · changes stay in memory until the server restarts</div>
      )}
      <main className={wide ? "app-main app-main--wide" : "app-main"}>{children}</main>
    </div>
  );
}
