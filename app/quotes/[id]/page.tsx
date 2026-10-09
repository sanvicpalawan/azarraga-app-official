import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { QuoteEditor } from "@/components/quote-editor";
import { ShareMenu } from "@/components/share-menu";
import { QuoteActions } from "@/components/quote-actions";
import { getSettings, loadDocument, quoteAlreadyInvoiced } from "@/lib/documents";
import { loadCategoriesWithPrefix, loadItems, loadSpecGroups } from "@/lib/spec-options";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, settings, specGroups, categories, items] = await Promise.all([
    loadDocument(id),
    getSettings(),
    loadSpecGroups(),
    loadCategoriesWithPrefix(),
    loadItems(),
  ]);

  if (!doc || doc.type !== "quote") notFound();

  const hasInvoice = await quoteAlreadyInvoiced(doc.id);
  const shareUrl = `/share/${doc.shareToken}`;

  return (
    <AppShell>
      <div className="page-head">
        <Link href="/quotes" className="btn btn--ghost btn--sm">
          <ArrowLeft size={15} /> Quotes
        </Link>
        <div>
          <h1>{doc.number}</h1>
          <p className="page-sub">
            <span className={`status-pill status-pill--${doc.status}`}>{doc.status}</span>{" "}
            {doc.client.name}
          </p>
        </div>
        <div className="spacer" />
        <ShareMenu
          shareUrl={shareUrl}
          number={doc.number}
          clientName={doc.client.name}
          clientPhone={doc.client.phone}
          clientEmail={doc.client.email}
          total={doc.total}
          currency={doc.currency}
          type="quote"
        />
      </div>

      <QuoteEditor
        document={doc}
        specGroups={specGroups}
        categories={categories}
        items={items}
        settings={settings}
      />

      <div className="sticky-save" style={{ position: "static", marginTop: 16 }}>
        <QuoteActions documentId={doc.id} status={doc.status} hasInvoice={hasInvoice} />
      </div>
    </AppShell>
  );
}
