import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";
import { getSettings } from "@/lib/documents";
import { loadCategoriesWithPrefix, loadItems, loadSpecGroups } from "@/lib/spec-options";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const [settings, specGroups, categories, items] = await Promise.all([
    getSettings(),
    loadSpecGroups(),
    loadCategoriesWithPrefix(),
    loadItems(),
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
      />
    </AppShell>
  );
}
