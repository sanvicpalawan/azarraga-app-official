"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product, Settings } from "@/lib/catalog-types";
import type { QuotationItem } from "@/lib/catalog-store-types";
import { elevationSvg, svgDataUrl } from "@/lib/elevation-icon";
import {
  buildLineDescription,
  buildTotals,
  computeQuoteTotals,
  deriveUnit,
  itemCodePrefix,
  money2,
  paymentTermsLines,
  quantityAndUnitCost,
} from "@/lib/quote-format";

export type QuoteLine = { id: string; product: Product; item: QuotationItem };

type Props = {
  settings: Settings;
  logoSrc: string;
  lines: QuoteLine[];
  quotationNumber: string;
  quoteDate: string;
  customerName: string;
  projectName: string;
  projectAddress: string;
  delivery: string;
  discount: string;
  leadTime: string;
  onDeliveryChange: (value: string) => void;
  onDiscountChange: (value: string) => void;
  onLeadTimeChange: (value: string) => void;
  onEditLine: (line: QuoteLine) => void;
  onRemoveLine: (id: string) => void;
};

const number = (value: string) => Math.max(0, Number(value) || 0);

/**
 * The quotation exactly as the client already produces it by hand in Excel:
 * letterhead, customer/date/number row, the ITEM# · DESCRIPTION · elevation ·
 * QTY · UNIT · UNIT COST · SUBTOTAL table, a right-aligned totals block and the
 * payment terms paragraph. Everything the admin controls (logo, address,
 * phones, email, company name, lead-time default) is read from Settings so a
 * change of contact details never needs a developer.
 */
export function QuotationDocument({
  settings,
  logoSrc,
  lines,
  quotationNumber,
  quoteDate,
  customerName,
  projectName,
  projectAddress,
  delivery,
  discount,
  leadTime,
  onDeliveryChange,
  onDiscountChange,
  onLeadTimeChange,
  onEditLine,
  onRemoveLine,
}: Props) {
  const totals = useMemo(
    () => computeQuoteTotals(lines.map((line) => line.item), number(delivery), number(discount)),
    [lines, delivery, discount],
  );

  const totalRows = useMemo(
    () => buildTotals(totals),
    [totals],
  );

  const terms = useMemo(
    () => paymentTermsLines(leadTime, settings.companyName),
    [leadTime, settings.companyName],
  );

  const drawingByLine = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines) {
      const { item } = line;
      map.set(
        line.id,
        svgDataUrl(
          elevationSvg(
            {
              description: item.description,
              itemCode: item.itemCode,
              widthM: item.widthM || undefined,
              heightM: item.heightM || undefined,
            },
            { tone: "grey" },
          ),
        ),
      );
    }
    return map;
  }, [lines]);

  const recipient = [projectName, projectAddress].filter((value) => value.trim()).join(" · ");

  return (
    <article className="quotation-page" id="quotation-document">
      <header className="quote-letterhead">
        <img className="quote-letterhead-logo" src={logoSrc} alt={settings.companyName} />
        <div className="quote-letterhead-contact">
          {settings.address && <span>{settings.address}</span>}
          {settings.contactNumbers && <span>{settings.contactNumbers}</span>}
          {settings.email && <span>{settings.email}</span>}
        </div>
        {settings.pdfHeader && <div className="pdf-header-text">{settings.pdfHeader}</div>}
      </header>

      <div className="invoice-meta">
        <div>
          <strong>{customerName || "Customer Name"}</strong>
          <span>{recipient}</span>
        </div>
        <div>
          <strong>{quoteDate}</strong>
          <span>Quotation # {quotationNumber || "DRAFT"}</span>
        </div>
      </div>

      <div className="quote-table-wrap">
        <table className="quote-table invoice-table">
          <thead>
            <tr>
              <th scope="col">ITEM#</th>
              <th scope="col">DESCRIPTION</th>
              <th scope="col" className="elevation-column">
                <span className="visually-hidden">Elevation</span>
              </th>
              <th scope="col">QTY</th>
              <th scope="col">UNIT</th>
              <th scope="col">UNIT COST</th>
              <th scope="col">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const { item } = line;
              const prefix =
                (item.itemCode || "").replace(/\d+$/, "") ||
                itemCodePrefix(item.productName, line.product.categoryName);
              const { qty, unitCost } = quantityAndUnitCost(item, prefix);
              const unit = item.unit || deriveUnit(prefix, qty);
              return (
                <tr key={line.id}>
                  <td data-label="ITEM#" className="item-code-cell">
                    {item.itemCode || prefix}
                  </td>
                  <td data-label="DESCRIPTION">
                    {buildLineDescription(item, line.product.description)}
                    <div className="no-print quote-control-actions">
                      <Button variant="outline" onClick={() => onEditLine(line)}>Edit</Button>
                      <Button variant="outline" onClick={() => onRemoveLine(line.id)}>Remove</Button>
                    </div>
                  </td>
                  <td data-label="Elevation" className="elevation-cell">
                    <img src={drawingByLine.get(line.id)} alt="" />
                  </td>
                  <td data-label="QTY">{Number.isInteger(qty) ? qty : qty.toFixed(2)}</td>
                  <td data-label="UNIT">{unit}</td>
                  <td data-label="UNIT COST">{money2(unitCost)}</td>
                  <td data-label="SUBTOTAL" className="line-total-cell">{money2(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="invoice-lower">
        <div className="quote-totals">
          {totalRows.map((row) => (
            <div key={row.label} className={`quote-total-row${row.emphasised ? " emphasised" : ""}`}>
              <span>{row.label}</span>
              <strong>{money2(row.amount)}</strong>
            </div>
          ))}
          <div className="quote-total-row no-print editable-row">
            <label htmlFor="delivery">Delivery</label>
            <Input
              id="delivery"
              type="number"
              min="0"
              step="0.01"
              value={delivery}
              onChange={(event) => onDeliveryChange(event.target.value)}
            />
          </div>
          <div className="quote-total-row no-print editable-row">
            <label htmlFor="discount">Discount</label>
            <Input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => onDiscountChange(event.target.value)}
            />
          </div>
        </div>

        <div className="payment-terms">
          <div className="no-print lead-time-field">
            <label htmlFor="lead-time">Lead Time (working days)</label>
            <Input
              id="lead-time"
              value={leadTime}
              placeholder="e.g. 30-45"
              onChange={(event) => onLeadTimeChange(event.target.value)}
            />
          </div>
          {terms.map((line, index) => (
            <p key={`${line}-${index}`} className={index === 0 ? "terms-title" : undefined}>
              {line}
            </p>
          ))}
        </div>
      </div>

      {settings.termsConditions.trim() && (
        <section className="terms-box">
          <span className="quote-label">TERMS &amp; CONDITIONS</span>
          <p>{settings.termsConditions}</p>
        </section>
      )}
    </article>
  );
}
