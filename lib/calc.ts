/**
 * Single source of truth for all document math.
 * Used by the editor (live totals) AND by server actions (what gets saved).
 * All money is integer minor units (centavos / cents). Never floats.
 *
 * Model:
 *  - A document has sections. "included" sections are always summed.
 *  - "alternative" sections are options; only the selected one is summed.
 *  - Extra charges (delivery, installation) are added after discount.
 *  - Unit prices are typed by the user. per_area pricing is optional and
 *    rarely used: real prices are not linear in area.
 */

export type VatMode = "none" | "exclusive" | "inclusive";
export type PricingMode = "per_unit" | "per_area";
export type AreaUnit = "sqft" | "sqm";
export type SectionKind = "included" | "alternative";
export type Discount =
  | { type: "percent"; value: number } // 0-100
  | { type: "fixed"; value: number }; // minor units

export type LineOption = { priceAdjustment: number }; // flat per piece, minor units
export type Charge = { label: string; amount: number };

export interface LineInput {
  pricingMode: PricingMode;
  unitPrice: number; // per set, or per area unit when per_area
  quantity: number;
  widthMm?: number | null;
  heightMm?: number | null;
  areaUnit?: AreaUnit;
  minArea?: number;
  options?: LineOption[];
}

export interface LineResult {
  area: number | null;
  unitTotal: number;
  lineTotal: number;
}

export interface SectionInput {
  id: string;
  kind: SectionKind;
  lines: LineInput[];
}

export interface DocumentInput {
  sections: SectionInput[];
  selectedAlternativeId?: string | null;
  charges?: Charge[];
  discount?: Discount;
  vatMode: VatMode;
  vatRate: number; // percent
  depositPercent?: number; // 0-100
  amountPaid?: number;
}

export interface SectionResult {
  id: string;
  kind: SectionKind;
  lines: LineResult[];
  subtotal: number;
  counted: boolean; // included in the document total
}

export interface DocumentResult {
  sections: SectionResult[];
  subtotal: number; // counted sections only
  discountAmount: number;
  chargesTotal: number;
  vatableSales: number;
  vatAmount: number;
  total: number;
  deposit: number;
  amountPaid: number;
  balance: number;
  hasUnselectedAlternatives: boolean;
}

const MM2_PER_SQFT = 304.8 * 304.8;
const MM2_PER_SQM = 1_000_000;

export const roundMoney = (n: number): number => Math.round(n);
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const round2 = (n: number) => Math.round(n * 100) / 100;

export function areaOf(
  widthMm: number,
  heightMm: number,
  unit: AreaUnit = "sqm",
  minArea = 0,
): number {
  const div = unit === "sqft" ? MM2_PER_SQFT : MM2_PER_SQM;
  return Math.max(round2((widthMm * heightMm) / div), minArea);
}

/** Price per square metre implied by a typed price. Display-only sanity hint. */
export function pricePerSqm(
  unitPrice: number,
  widthMm?: number | null,
  heightMm?: number | null,
): number | null {
  if (!widthMm || !heightMm) return null;
  const area = (widthMm * heightMm) / MM2_PER_SQM;
  return area > 0 ? roundMoney(unitPrice / area) : null;
}

export function computeLine(line: LineInput): LineResult {
  const quantity = Math.max(line.quantity, 0);
  const adjustments = (line.options ?? []).reduce((s, o) => s + o.priceAdjustment, 0);

  let area: number | null = null;
  let base = line.unitPrice;

  if (line.pricingMode === "per_area") {
    area =
      line.widthMm && line.heightMm
        ? areaOf(line.widthMm, line.heightMm, line.areaUnit ?? "sqm", line.minArea ?? 0)
        : 0;
    base = line.unitPrice * area;
  }

  const unitTotal = roundMoney(base + adjustments);
  const lineTotal = roundMoney(unitTotal * quantity);
  return { area, unitTotal, lineTotal };
}

export function computeDocument(input: DocumentInput): DocumentResult {
  const sections: SectionResult[] = input.sections.map((s) => {
    const lines = s.lines.map(computeLine);
    const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
    const counted =
      s.kind === "included" || (!!input.selectedAlternativeId && s.id === input.selectedAlternativeId);
    return { id: s.id, kind: s.kind, lines, subtotal, counted };
  });

  const hasUnselectedAlternatives =
    input.sections.some((s) => s.kind === "alternative") && !input.selectedAlternativeId;

  const subtotal = sections.filter((s) => s.counted).reduce((sum, s) => sum + s.subtotal, 0);

  let discountAmount = 0;
  if (input.discount) {
    discountAmount =
      input.discount.type === "percent"
        ? roundMoney((subtotal * clamp(input.discount.value, 0, 100)) / 100)
        : clamp(input.discount.value, 0, subtotal);
  }

  const chargesTotal = (input.charges ?? []).reduce((s, c) => s + c.amount, 0);
  const net = subtotal - discountAmount + chargesTotal;
  const rate = input.vatRate / 100;

  let vatAmount = 0;
  let total = net;
  let vatableSales = net;

  if (input.vatMode === "exclusive") {
    vatAmount = roundMoney(net * rate);
    total = net + vatAmount;
  } else if (input.vatMode === "inclusive") {
    vatAmount = roundMoney(net - net / (1 + rate));
    vatableSales = net - vatAmount;
  }

  const deposit = roundMoney((total * clamp(input.depositPercent ?? 0, 0, 100)) / 100);
  const amountPaid = input.amountPaid ?? 0;
  const balance = Math.max(total - amountPaid, 0);

  return {
    sections,
    subtotal,
    discountAmount,
    chargesTotal,
    vatableSales,
    vatAmount,
    total,
    deposit,
    amountPaid,
    balance,
    hasUnselectedAlternatives,
  };
}

/**
 * Full result for each alternative as if it were the selected one.
 * Use this to print "Total" under every option on the quote.
 */
export function computeAlternatives(input: DocumentInput): Record<string, DocumentResult> {
  const out: Record<string, DocumentResult> = {};
  for (const s of input.sections) {
    if (s.kind === "alternative") {
      out[s.id] = computeDocument({ ...input, selectedAlternativeId: s.id, amountPaid: 0 });
    }
  }
  return out;
}

export function paymentStatus(total: number, amountPaid: number): "unpaid" | "partial" | "paid" {
  if (total > 0 && amountPaid >= total) return "paid";
  if (amountPaid > 0) return "partial";
  return "unpaid";
}

export function isOverdue(
  dueDate: string | null,
  status: string,
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!dueDate) return false;
  if (status !== "unpaid" && status !== "partial") return false;
  return dueDate < today;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
