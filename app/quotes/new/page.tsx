import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";
import { getSettings, listCustomers } from "@/lib/documents";
import { getCatalogSnapshot, getProject } from "@/lib/catalog-store";
import { historicalLineSeed } from "@/lib/historical-line";
import { loadCategoriesWithPrefix, loadItems, loadSpecGroups } from "@/lib/spec-options";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{customer?:string;product?:string;description?:string;sourceProject?:string;sourceItem?:string;type?:string}> }) {
  const params=await searchParams;
  const [settings, specGroups, categories, items, customers, catalog, source] = await Promise.all([
    getSettings(),
    loadSpecGroups(),
    loadCategoriesWithPrefix(),
    loadItems(),
    listCustomers(),
    params.product ? getCatalogSnapshot() : Promise.resolve(null),
    params.sourceProject && /^\d+$/.test(params.sourceProject) ? getProject(Number(params.sourceProject)) : Promise.resolve(null),
  ]);
  const sourceItem=source?.items.find(item=>item.id===params.sourceItem);
  const historicalSeed=source && sourceItem ? historicalLineSeed(source,sourceItem) : undefined;
  const initialProduct=catalog?.products.find(product=>String(product.id)===params.product);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>{params.type === "invoice" ? "New invoice" : "New quotation"}</h1>
          <p className="page-sub">Prices are in {historicalSeed?.currency ?? (initialProduct ? "PHP" : settings.currency)}. Sizes are in metres.</p>
        </div>
      </div>

      <QuoteEditor
        specGroups={specGroups}
        categories={categories}
        items={items}
        settings={settings}
        customers={customers}
        initialCustomerId={params.customer}
        initialDocumentType={params.type === "invoice" ? "invoice" : "quote"}
        initialProduct={initialProduct}
        initialDescription={params.description}
        initialHistoricalLine={historicalSeed}
      />
    </AppShell>
  );
}
