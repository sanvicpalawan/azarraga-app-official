import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/lib/currency";
import { listDocuments, peekNextDocumentNumber } from "@/lib/documents";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Partly paid" },
  { key: "paid", label: "Paid" },
];

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;
  const [items, nextNumber] = await Promise.all([
    listDocuments({ type: "invoice", status: status === "all" ? undefined : (status as never) }),
    peekNextDocumentNumber("invoice"),
  ]);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="page-sub">
            Next number: <strong>{nextNumber}</strong>
          </p>
        </div>
        <div className="spacer" />
        <Link href="/quotes" className="btn">
          Go to quotes
        </Link>
      </div>

      <div className="chip-row">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/invoices" : `/invoices?status=${f.key}`}
            className="chip"
            aria-pressed={status === f.key}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <Receipt size={30} />
          <h3>No invoices yet</h3>
          <p>Open an accepted quote and choose Convert to invoice to create one.</p>
          <Link href="/quotes" className="btn btn--primary">
            Review quotes
          </Link>
        </div>
      ) : (
        <div className="doc-list">
          {items.map((doc) => {
            const balance = Math.max(doc.total - doc.amountPaid, 0);
            return (
              <Link key={doc.id} href={`/invoices/${doc.id}`} className="doc-card">
                <div>
                  <div className="doc-card__num">{doc.number}</div>
                  <div className="doc-card__client">{doc.clientName}</div>
                </div>
                <div className="doc-card__right">
                  <span className="doc-card__total">{formatMoney(doc.total, doc.currency)}</span>
                  <span className={`status-pill status-pill--${doc.paymentStatus}`}>
                    {doc.paymentStatus}
                  </span>
                </div>
                <div className="doc-card__meta">
                  <span>{doc.projectName || "No project name"}</span>
                  <span>Issued {longDate(doc.issueDate)}</span>
                  {doc.dueDate && <span>Due {longDate(doc.dueDate)}</span>}
                  {balance > 0 && <span>Balance {formatMoney(balance, doc.currency)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
