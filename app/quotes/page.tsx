import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/lib/currency";
import { listDocuments, peekNextDocumentNumber } from "@/lib/documents";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
];

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const [items, nextNumber] = await Promise.all([
    listDocuments({ type: "quote", status: status === "all" ? undefined : (status as never) }),
    peekNextDocumentNumber("quote"),
  ]);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Quotations</h1>
          <p className="page-sub">
            Next number: <strong>{nextNumber}</strong>
          </p>
        </div>
        <div className="spacer" />
        <Link href="/quotes/new" className="btn btn--primary">
          <Plus size={16} /> New quote
        </Link>
      </div>

      <div className="chip-row">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/quotes" : `/quotes?status=${f.key}`}
            className="chip"
            aria-pressed={status === f.key}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Search size={30} />
          <h3>No quotations here yet</h3>
          <p>Quotes you start will show up in this list with their status.</p>
          <Link href="/quotes/new" className="btn btn--primary">
            <Plus size={16} /> Create the first quote
          </Link>
        </div>
      ) : (
        <div className="doc-list">
          {items.map((doc) => (
            <Link key={doc.id} href={`/quotes/${doc.id}`} className="doc-card">
              <div>
                <div className="doc-card__num">{doc.number}</div>
                <div className="doc-card__client">{doc.clientName}</div>
              </div>
              <div className="doc-card__right">
                <span className="doc-card__total">{formatMoney(doc.total, doc.currency)}</span>
                <span className={`status-pill status-pill--${doc.status}`}>{doc.status}</span>
              </div>
              <div className="doc-card__meta">
                <span>{doc.projectName || "No project name"}</span>
                <span>{longDate(doc.issueDate)}</span>
                {doc.acceptedSectionId && <span>Option chosen</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
