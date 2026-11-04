import { AppShell } from "@/components/app-shell";
import { CustomerManager } from "@/components/customer-manager";
import { listCustomers } from "@/lib/documents";
export const dynamic = "force-dynamic";
export default async function CustomersPage() {
  return <AppShell><div className="page-head"><div><h1>Customers</h1><p className="page-sub">Reusable contact details for every quotation and project.</p></div></div><CustomerManager customers={await listCustomers()} /></AppShell>;
}
