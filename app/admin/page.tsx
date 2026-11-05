import Link from "next/link";
import { AppShell } from "@/components/app-shell";
export default function AdminPage() {
  return <AppShell><div className="page-head"><div><h1>Administration</h1><p className="page-sub">Company details, products and quotation options.</p></div></div><div className="admin-card"><h2>Management</h2><p><Link href="/admin/assistant">Data Assistant · OpenRouter key and free models</Link></p><p><Link href="/admin/settings">Company and document settings</Link></p><p><Link href="/admin/catalog?tab=products">Products and images</Link></p><p><Link href="/admin/catalog">Dropdown attributes</Link></p><p><Link href="/customers">Customers</Link></p></div></AppShell>;
}
