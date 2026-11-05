import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";
import { getSettings, listCustomers, loadDocument } from "@/lib/documents";
import { loadCategoriesWithPrefix, loadItems, loadSpecGroups } from "@/lib/spec-options";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const [doc,settings,customers,specGroups,categories,items]=await Promise.all([
    loadDocument(id),getSettings(),listCustomers(),loadSpecGroups(),loadCategoriesWithPrefix(),loadItems(),
  ]);
  if(!doc || doc.type!=="invoice")notFound();
  return <AppShell>
    <div className="page-head"><div><h1>Edit {doc.number}</h1><p className="page-sub">Change prices, quantities, specifications and drawings. Recorded payments stay attached.</p></div><Link className="btn" href={`/invoices/${id}`}>Invoice & payments</Link></div>
    <QuoteEditor document={doc} settings={settings} customers={customers} specGroups={specGroups} categories={categories} items={items}/>
  </AppShell>;
}
