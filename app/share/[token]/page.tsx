import { Fragment } from "react";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/currency";
import { findByShareToken, getSettings, markViewed } from "@/lib/documents";
import { ShareAccept } from "@/components/share-accept";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [doc, settings] = await Promise.all([
    findByShareToken(token),
    getSettings(),
  ]);
  if (!doc) notFound();

  // First open by the client, recorded once.
  if (!doc.viewedAt) await markViewed(doc.id);

  const deposit = Math.round((doc.total * Number(doc.depositPercent)) / 100);

  return (
    <div className="share-shell">
      <header className="share-head">
        {settings.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoDataUrl as string} alt="Logo" className="share-head__logo" />
        ) : (
          <div className="share-head__mark">AG</div>
        )}
        <div>
          <p className="share-head__company">{String(settings.name)}</p>
          <p className="share-head__meta">
            {String(settings.address)} · {String(settings.phone)}
          </p>
        </div>
      </header>

      <main className="share-doc">
        <div className="share-doc__title">
          <div>
            <span className="share-doc__kicker">
              {doc.type === "quote" ? "Quotation" : "Invoice"}
            </span>
            <h1>{doc.number}</h1>
          </div>
          <span className={`status-pill status-pill--${doc.status}`}>{doc.status}</span>
        </div>

        <div className="share-doc__parties">
          <div>
            <span className="share-doc__label">Prepared for</span>
            <strong>{doc.client.name}</strong>
            {doc.client.phone && <p>{doc.client.phone}</p>}
            {doc.client.address && <p>{doc.client.address}</p>}
          </div>
          <div>
            <span className="share-doc__label">Project</span>
            <strong>{doc.projectName ?? "—"}</strong>
            {doc.projectAddress && <p>{doc.projectAddress}</p>}
            <p>Issued {doc.issueDate}</p>
            {doc.leadTime && <p>Lead time {doc.leadTime}</p>}
          </div>
        </div>

        <table className="share-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Drawing</th>
              <th>Qty</th>
              <th>Unit cost</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {doc.sections.map((section, sIdx) => {
              const chosen = section.kind === "included" || doc.acceptedSectionId === section.id;
              if (!chosen) return null;
              return (
                <Fragment key={section.id}>
                  {section.kind === "alternative" && section.title && (
                    <tr className="share-table__group">
                      <td colSpan={6}>{section.title}</td>
                    </tr>
                  )}
                  {section.lines.map((line, lIdx) => (
                    <tr key={line.id}>
                      <td>{line.code ?? `${sIdx + 1}.${lIdx + 1}`}</td>
                      <td>{line.description}</td>
                      <td style={{ width: 120, minWidth: 100, textAlign: "center" }}>
                        {typeof line.designJson?.previewPng === "string" && line.designJson.previewPng.startsWith("data:image/png;base64,") && (
                          // eslint-disable-next-line @next/next/no-img-element -- immutable saved drawing data URL
                          <img src={line.designJson.previewPng} alt={`Drawing for ${line.code ?? line.description}`} style={{ display: "block", width: 120, height: 96, objectFit: "contain", margin: "0 auto" }} />
                        )}
                      </td>
                      <td>
                        {Number(line.quantity)} {line.unit}
                      </td>
                      <td>{formatMoney(Number(line.unitPrice), doc.currency)}</td>
                      <td>{formatMoney(Number(line.lineTotal), doc.currency)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="share-totals">
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
          {Number(doc.vatAmount) > 0 && (
            <div className="total-line">
              <span>VAT ({Number(doc.vatRate)}%)</span>
              <strong>{formatMoney(Number(doc.vatAmount), doc.currency)}</strong>
            </div>
          )}
          <div className="total-line total-line--grand">
            <span>Total</span>
            <strong>{formatMoney(doc.total, doc.currency)}</strong>
          </div>
          <div className="total-line total-line--deposit">
            <span>{Number(doc.depositPercent)}% down payment</span>
            <strong>{formatMoney(deposit, doc.currency)}</strong>
          </div>
        </div>

        {doc.terms && (
          <section className="share-terms">
            <h2>Payment terms</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{doc.terms}</p>
          </section>
        )}

        <ShareAccept
          documentId={doc.id}
          status={doc.status}
          type={doc.type}
          acceptedAt={doc.acceptedAt ? doc.acceptedAt.toISOString() : null}
          phone={settings.phone as string}
        />
      </main>

      <footer className="share-foot">
        Sent by {String(settings.name)} · {String(settings.phone)}
      </footer>
    </div>
  );
}
