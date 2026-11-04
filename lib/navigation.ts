export type OwnerSection = "quotes" | "invoices" | "studio" | "products" | "projects" | "settings" | "customers";
export type CatalogView = "catalog" | "library" | "studio" | "projects" | "admin";

export const OWNER_NAVIGATION: { id: OwnerSection; href: string; label: string }[] = [
  { id: "quotes", href: "/quotes", label: "Quotations" },
  { id: "invoices", href: "/invoices", label: "Invoices" },
  { id: "customers", href: "/customers", label: "Customers" },
  { id: "studio", href: "/catalog?view=studio", label: "Design Studio" },
  { id: "products", href: "/catalog?view=library", label: "Products" },
  { id: "projects", href: "/catalog?view=projects", label: "Past Projects" },
  { id: "settings", href: "/admin", label: "Administration" },
];

export function catalogView(value: string | null): CatalogView {
  return value === "library" || value === "studio" || value === "projects" || value === "admin"
    ? value : "catalog";
}

export function ownerSection(pathname: string, view: CatalogView = "catalog"): OwnerSection {
  if (pathname === "/catalog") {
    return view === "studio" ? "studio" : view === "projects" ? "projects" : view === "admin" ? "settings" : "products";
  }
  if (pathname === "/invoices" || pathname.startsWith("/invoices/")) return "invoices";
  if (pathname === "/customers") return "customers";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "settings";
  return "quotes";
}
