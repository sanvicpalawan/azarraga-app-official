import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";
import { getSettings, listCustomers } from "@/lib/documents";
import { getCatalogSnapshot } from "@/lib/catalog-store";
import { loadCategoriesWithPrefix, loadItems, loadSpecGroups } from "@/lib/spec-options";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{customer?:string;product?:string;description?:string}> }) {
  const params=await searchParams;
  const [settings, specGroups, categories, items, customers, catalog] = await Promise.all([
    getSettings(),
    loadSpecGroups(),
    loadCategoriesWithPrefix(),
    loadItems(),
    listCustomers(),
    params.product ? getCatalogSnapshot() : Promise.resolve(null),
  ]);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>New quotation</h1>
          <p className="page-sub">Prices are in {settings.currency}. Sizes are in metres.</p>
        </div>
      </div>

      <QuoteEditor
        specGroups={specGroups}
        categories={categories}
        items={items}
        settings={settings}
        customers={customers}
        initialCustomerId={params.customer}
        initialProduct={catalog?.products.find((product)=>String(product.id)===params.product)}
        initialDescription={params.description}
      />
    </AppShell>
  );
}
