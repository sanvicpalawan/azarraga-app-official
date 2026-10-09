// The client builds every quotation in Excel by hand. These helpers describe
// that document: the ITEM#/DESCRIPTION/drawing/QTY/UNIT/UNIT COST/SUBTOTAL
// columns, the per-item codes, the totals block and the payment terms block.
// Everything here is pure so the printable component and any future export
// path agree on the exact same output.

export const FEET_TO_METRE = 0.3048;
export const DEFAULT_LEAD_TIME = "30-45";

export const money2 = (value: number): string =>
  (Number.isFinite(value) ? value : 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Feet -> metres, kept at 4 dp so the printed size never drifts from the input. */
export const feetToMetre = (feet: number | string): number =>
  Math.round((Number(feet) || 0) * FEET_TO_METRE * 10000) / 10000;

/**
 * A dimension as their sheet prints it: always two decimals, three only when
 * the value actually needs them — 1.20, 0.25, 3.345, 10.00.
 */
export function formatMetre(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return value.toFixed(3).replace(/(\.\d{2}\d*?)0+$/, "$1");
}

export type Dimensioned = { width: number; height: number; widthM?: number; heightM?: number };

/** "1.20 x 1.20" — the trailing clause of every description on their invoices. */
export function dimensionsText(item: Dimensioned): string {
  const w = formatMetre(item.widthM || feetToMetre(item.width));
  const h = formatMetre(item.heightM || feetToMetre(item.height));
  return w && h ? `${w} x ${h}` : "";
}

const meaningful = (value: string | undefined | null): string => {
  const trimmed = (value || "").trim();
  if (!trimmed || trimmed.toUpperCase() === "N/A" || trimmed === "-") return "";
  return trimmed;
};

export type Describable = {
  productName: string;
  sectionType: string;
  glass: string;
  color: string;
  width: number;
  height: number;
  widthM?: number;
  heightM?: number;
  description: string;
};

/**
 * One comma-joined line, exactly as theirs reads:
 * "798 Series Sliding Window with Sliding Screen, Black Frame,
 *  6mm Annealed Clear Glass, 1.20 x 1.20"
 * The free-text note is only added when the user actually overrode the
 * product's stock description, so the column stays clean.
 */
export function buildLineDescription(item: Describable, stockDescription?: string): string {
  const parts: string[] = [item.productName.trim() || "Item"];

  const series = meaningful(item.sectionType);
  if (series && !item.productName.toLowerCase().includes(series.toLowerCase())) parts.push(series);

  const color = meaningful(item.color);
  if (color) parts.push(color);

  const glass = meaningful(item.glass);
  if (glass && !parts.some((part) => part.toLowerCase().includes(glass.toLowerCase()))) parts.push(glass);

  const dims = dimensionsText(item);
  if (dims) parts.push(dims);

  const note = item.description.trim();
  if (note && (!stockDescription || note !== stockDescription.trim())) parts.push(note);

  return parts.join(", ");
}

/**
 * Their codes: windows W1…, doors D1…, louvers AL1…, bi-folds BD1…, and the
 * un-numbered singletons SE (shower enclosure) and SR (railing).
 */
export function itemCodePrefix(name: string, categoryName: string): string {
  const n = (name || "").toLowerCase();
  const category = (categoryName || "").toLowerCase();

  if (n.includes("shower")) return "SE";
  if (n.includes("railing") || n.includes("handrail")) return "SR";
  if (n.includes("bi fold") || n.includes("bifold") || n.includes("bi-fold")) return "BD";
  if (n.includes("door") || category === "doors") return "D";
  if (
    n.includes("window") ||
    n.includes("jalous") ||
    n.includes("awning") ||
    n.includes("casement") ||
    n.includes("skylight")
  ) {
    return "W";
  }
  if (n.includes("louver")) return "AL";
  if (category === "windows") return "W";
  if (category === "others") return "OT";
  return "W";
}

/**
 * Codes restart for every prefix inside one quotation, so a 5-louver + 6-window
 * job reads AL1…AL5 and W1…W6 just like their sheets. SE/SR only gain a number
 * when the quote contains more than one of them.
 */
export function computeItemCodes(lines: Array<{ name: string; category: string }>): string[] {
  const prefixes = lines.map((line) => itemCodePrefix(line.name, line.category));
  const totals = new Map<string, number>();
  for (const prefix of prefixes) totals.set(prefix, (totals.get(prefix) || 0) + 1);

  const seen = new Map<string, number>();
  return prefixes.map((prefix) => {
    const index = (seen.get(prefix) || 0) + 1;
    seen.set(prefix, index);
    const singleton = (prefix === "SE" || prefix === "SR") && (totals.get(prefix) || 0) === 1;
    return singleton ? prefix : `${prefix}${index}`;
  });
}

export type Priced = {
  pricingMethod: "sqft" | "unit";
  rate: number;
  quantity: number;
  sqft: number;
  total: number;
};

/**
 * QTY and UNIT COST must always multiply back to SUBTOTAL. Railings are the
 * one case measured in linear metres, which is how their SR rows read
 * ("10.70 | LM").
 */
export function quantityAndUnitCost(
  item: Priced,
  prefix: string,
): { qty: number; unitCost: number } {
  const quantity = Math.max(1, item.quantity);
  const qty = prefix === "SR" && item.pricingMethod === "sqft" ? item.sqft : quantity;
  const unitCost = qty > 0 ? item.total / qty : item.total;
  return { qty, unitCost };
}

export function deriveUnit(prefix: string, qty: number): string {
  if (prefix === "SR") return "LM";
  return Math.round(qty) === 1 ? "set" : "sets";
}

export type QuoteTotals = {
  subtotal: number;
  totalArea: number;
  delivery: number;
  discount: number;
  grandTotal: number;
};

/** One source of truth for the money, used by the screen and by the printout. */
export function computeQuoteTotals(
  items: Array<{ total: number; sqft: number }>,
  delivery: number,
  discount: number,
): QuoteTotals {
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalArea = items.reduce((sum, item) => sum + (item.sqft || 0), 0);
  const deliveryValue = Math.max(0, Number.isFinite(delivery) ? delivery : 0);
  const ceiling = Math.max(0, subtotal + deliveryValue);
  const discountValue = Math.min(Math.max(0, Number.isFinite(discount) ? discount : 0), ceiling);
  return {
    subtotal,
    totalArea,
    delivery: deliveryValue,
    discount: discountValue,
    grandTotal: subtotal + deliveryValue - discountValue,
  };
}

export type TotalRow = { label: string; amount: number; emphasised?: boolean };

/**
 * Their totals arrive in three shapes: a bare "Total", or
 * "Sub Total" + a delivery line + "Total". Sub Total only appears when there
 * is something between it and the Total, which is exactly how they type it.
 */
export function buildTotals(input: {
  subtotal: number;
  delivery: number;
  discount: number;
  grandTotal: number;
}): TotalRow[] {
  const rows: TotalRow[] = [];
  const breakdown = input.delivery > 0 || input.discount > 0;
  if (breakdown) {
    rows.push({ label: "Sub Total", amount: input.subtotal });
    if (input.delivery > 0) {
      rows.push({ label: "Delivery and Installation Cost", amount: input.delivery });
    }
    if (input.discount > 0) rows.push({ label: "Discount", amount: input.discount });
  }
  rows.push({ label: "Total", amount: input.grandTotal, emphasised: true });
  return rows;
}

/**
 * The payment terms block verbatim from their own quotations, with the two
 * values an admin or the job itself controls spliced in: the lead time
 * (30-45 / 5-10 / 45-60 / 7-15 depending on the job) and the company name.
 */
export function paymentTermsLines(leadTime: string, companyName: string): string[] {
  const term = (leadTime || "").trim() || DEFAULT_LEAD_TIME;
  const company = (companyName || "").trim() || "Azarraga Glass & Aluminum";
  return [
    "Payment Terms:",
    "70% Down Payment",
    "30% Full Payment upon Installation",
    `Lead Time: ${term} working days upon receipt of the Down Payment and Final Measurement.`,
    "Delivery and labor are included in the quotation.",
    `${company} has the right to remove all its property and forfeit the payment to correspond for any expenses incurred during installation as per your requirements, in case of nonpayment after completion. This quotation will serve as a contract once confirmation with deposit is made to us.`,
    "Lead Time will commence once the site is ready for installation. Down Payment is non-refundable.",
  ];
}
