import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PaymentPanel } from "@/components/payment-panel";
import { ShareMenu } from "@/components/share-menu";
import { formatMoney } from "@/lib/currency";
import { listPayments, loadDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await loadDocument(id);
  if (!doc || doc.type !== "invoice") notFound();

  const payments = await listPayments(id);
  const deposit = Math.round((doc.total * Number(doc.depositPercent)) / 100);

  return (
    <AppShell>
      <div className="page-head">
        <Link href="/invoices" className="btn btn--ghost btn--sm">
          <ArrowLeft size={15} /> Invoices
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
          shareUrl={`/share/${doc.shareToken}`}
          number={doc.number}
          clientName={doc.client.name}
          clientPhone={doc.client.phone}
          clientEmail={doc.client.email}
          total={doc.total}
          currency={doc.currency}
          type="invoice"
        />
      </div>

      <div className="editor-grid">
        <div className="editor__main">
          <section className="card">
            <div className="card__head">
              <h2>Details</h2>
            </div>
            <div className="field-grid">
              <div className="field">
                <label>Project</label>
                <input value={doc.projectName ?? ""} readOnly />
              </div>
              <div className="field">
                <label>Site</label>
                <input value={doc.projectAddress ?? ""} readOnly />
              </div>
              <div className="field">
                <label>Issued</label>
                <input value={doc.issueDate} readOnly />
              </div>
              <div className="field">
                <label>Due</label>
                <input value={doc.dueDate ?? ""} readOnly />
              </div>
              <div className="field field--span">
                <label>Lead time</label>
                <input value={doc.leadTime ?? ""} readOnly />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Items</h2>
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              {doc.sections.flatMap((s) =>
                s.lines.map((line) => (
                  <div key={line.id} className="total-line">
                    <span>
                      {line.code ? <strong className="line-code">{line.code}</strong> : null}{" "}
                      {line.description}
                      <br />
                      <small style={{ color: "#607188" }}>
                        {Number(line.quantity)} {line.unit} ×{" "}
                        {formatMoney(Number(line.unitPrice), doc.currency)}
                      </small>
                    </span>
                    <strong>{formatMoney(Number(line.lineTotal), doc.currency)}</strong>
                  </div>
                )),
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="total-line">
                <span>Sub total</span>
                <strong>{formatMoney(doc.subtotal, doc.currency)}</strong>
              </div>
              {Number(doc.discountAmount) > 0 && (
                <div className="total-line">
                  <span>Discount</span>
                  <strong>-{formatMoney(Number(doc.discountAmount), doc.currency)}</strong>
                </div>
              )}
              {Number(doc.chargesTotal) > 0 && (
                <div className="total-line">
                  <span>Delivery & installation</span>
                  <strong>{formatMoney(Number(doc.chargesTotal), doc.currency)}</strong>
                </div>
              )}
              <div className="total-line total-line--grand">
                <span>Total</span>
                <strong>{formatMoney(doc.total, doc.currency)}</strong>
              </div>
              <div className="total-line total-line--deposit">
                <span>{Number(doc.depositPercent)}% due now ({formatMoney(deposit, doc.currency)})</span>
                <strong>{formatMoney(Math.max(doc.total - doc.amountPaid, 0), doc.currency)}</strong>
              </div>
            </div>
          </section>

          {doc.terms && (
            <section className="card">
              <div className="card__head">
                <h2>Payment terms</h2>
              </div>
              <p style={{ whiteSpace: "pre-wrap", fontSize: ".84rem", lineHeight: 1.6, margin: 0 }}>
                {doc.terms}
              </p>
            </section>
          )}
        </div>

        <aside className="editor__side">
          <PaymentPanel
            documentId={doc.id}
            total={Number(doc.total)}
            amountPaid={Number(doc.amountPaid)}
            currency={doc.currency}
            payments={payments.map((p) => ({
              id: p.id,
              amount: Number(p.amount),
              method: p.method,
              reference: p.reference,
              paidAt: p.paidAt.toISOString(),
            }))}
          />
        </aside>
      </div>
    </AppShell>
  );
}
