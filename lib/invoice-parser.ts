// Real PDF invoice parser for Azarraga quotations.
// Reads actual embedded text + positions (via pdfjs-dist) — no OCR guessing,
// no hardcoded seed matching. Groups text runs around each item-code anchor
// (W1, D1, AL1, SE, SR, BD1...) since descriptions wrap onto their own lines
// above/below the code/qty/price line in this invoice template.

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "path";
import { fileURLToPath } from "url";

// Resolved lazily, on first real use — not at module load — because Next's build-time
// "collect page data" step evaluates this module in a limited environment where
// import.meta.resolve isn't available. At actual request time (Node) it works fine.
let pdfjsConfigured = false;
function ensurePdfjsConfigured() {
  if (pdfjsConfigured) return;
  const workerUrl = import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  GlobalWorkerOptions.workerSrc = workerUrl;
  const pdfjsPackageUrl = import.meta.resolve("pdfjs-dist/package.json");
  const root = path.dirname(fileURLToPath(pdfjsPackageUrl));
  standardFontDataUrl = "file://" + path.join(root, "standard_fonts") + "/";
  pdfjsConfigured = true;
}
let standardFontDataUrl = "";

export interface ParsedLineItem {
  itemCode: string | null;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  widthM: number | null;
  heightM: number | null;
  needsReview: boolean; // true when this row had no explicit item code (unlabeled line in the source PDF)
}

export interface ParsedInvoice {
  customerName: string;
  location: string;
  quoteNumber: string | null;
  date: string | null;
  items: ParsedLineItem[];
  subtotal: number;
  delivery: number;
  total: number | null;
  totalsReconciled: boolean;
}

type Run = { x: number; y: number; str: string };

async function extractRuns(buffer: Buffer): Promise<Run[][]> {
  ensurePdfjsConfigured();
  const data = new Uint8Array(buffer);
  const doc = await getDocument({
    data,
    standardFontDataUrl,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;
  const pages: Run[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const runs: Run[] = [];
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = (item.str ?? "").trim();
      if (!str) continue;
      const transform = item.transform;
      if (!transform || transform.length < 6) continue;
      const [, , , , x, y] = transform;
      runs.push({ x, y, str });
    }
    pages.push(runs);
  }
  return pages;
}

function groupRows(runs: Run[], tolerance = 4): Run[][] {
  const sorted = [...runs].sort((a, b) => b.y - a.y);
  const rows: Run[][] = [];
  for (const r of sorted) {
    const row = rows.find((row) => Math.abs(row[0].y - r.y) <= tolerance);
    if (row) row.push(r);
    else rows.push([r]);
  }
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  return rows;
}

const ITEM_CODE_RE = /^(D\d{1,2}|W\d{1,2}|AL\d|SE|SR|BD\d|Door)$/;
const MONEY_RE = /^[\d,]+\.\d{2}$/;
const MONEY_COLUMN_MIN_X = 400; // unit-cost/subtotal columns live here — dimension text like "2.40" also
// matches the money pattern (X.XX), so position, not just shape, is what tells them apart.
const DIM_RE = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i;
const LEFT_COLUMN_X = 60; // item-code column is left of this in the source template

const toNumber = (s: string) => parseFloat(s.replace(/,/g, ""));

/**
 * Cluster all text runs on a page into item blocks. Anchored on each row's
 * money pair (unit cost + subtotal), not the item code — a handful of real
 * invoices leave the ITEM# cell blank for a line (e.g. extra panel-count
 * variants of the same product), and those rows still need to come through.
 */
function clusterItems(runs: Run[]): Run[][] {
  const moneyRunsOnPage = runs.filter((r) => r.x > MONEY_COLUMN_MIN_X && MONEY_RE.test(r.str));
  const moneyRows = groupRows(moneyRunsOnPage, 3).filter((row) => row.length >= 2);
  if (moneyRows.length === 0) return [];
  const anchors = moneyRows.map((row) => row[0].y).sort((a, b) => b - a); // top to bottom
  const clusters: Run[][] = [];
  for (let i = 0; i < anchors.length; i++) {
    const y = anchors[i];
    const prevY = i > 0 ? anchors[i - 1] : Infinity;
    const nextY = i < anchors.length - 1 ? anchors[i + 1] : -Infinity;
    const upBound = Math.min(y + (prevY - y) / 2, y + 22);
    const downBound = Math.max(y - (y - nextY) / 2, y - 22);
    const cluster = runs.filter((r) => r.y <= upBound && r.y >= downBound);
    clusters.push(cluster);
  }
  return clusters;
}

function parseCluster(cluster: Run[]): ParsedLineItem | null {
  const rows = groupRows(cluster);
  const flatRuns = rows.flatMap((r) => r);
  const codeRun = cluster.find((r) => r.x < LEFT_COLUMN_X && ITEM_CODE_RE.test(r.str));
  const moneyRuns = cluster.filter((r) => r.x > MONEY_COLUMN_MIN_X && MONEY_RE.test(r.str)).sort((a, b) => a.x - b.x);
  if (moneyRuns.length < 2) return null;
  const unitCost = toNumber(moneyRuns[moneyRuns.length - 2].str);
  const subtotal = toNumber(moneyRuns[moneyRuns.length - 1].str);

  const unitRunIdx = flatRuns.findIndex((r) => /^sets?$/i.test(r.str));
  let qty = 1;
  let unit = "set";
  let qtyRun: Run | null = null;
  if (unitRunIdx > 0) {
    unit = flatRuns[unitRunIdx].str.toLowerCase();
    const qtyCand = flatRuns[unitRunIdx - 1];
    if (/^\d+(\.\d+)?$/.test(qtyCand.str)) {
      qty = parseFloat(qtyCand.str);
      qtyRun = qtyCand;
    }
  }

  // Exclude by run identity (not by string value) so a real number that happens
  // to equal the qty digit (e.g. a "2.40" height) never gets dropped from the description.
  const excludedRuns = new Set<Run>(moneyRuns);
  if (codeRun) excludedRuns.add(codeRun);
  if (qtyRun) excludedRuns.add(qtyRun);
  if (unitRunIdx >= 0) excludedRuns.add(flatRuns[unitRunIdx]);

  const descParts = cluster
    .filter((r) => !excludedRuns.has(r) && r.str !== "F")
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((r) => r.str);
  const description = descParts.join(" ").replace(/\s+/g, " ").trim();
  const dimMatch = description.match(DIM_RE);
  return {
    itemCode: codeRun ? codeRun.str : null,
    description,
    qty,
    unit,
    unitCost,
    subtotal,
    widthM: dimMatch ? parseFloat(dimMatch[1]) : null,
    heightM: dimMatch ? parseFloat(dimMatch[2]) : null,
    needsReview: !codeRun,
  };
}

export async function parseInvoicePdf(buffer: Buffer): Promise<ParsedInvoice> {
  const pages = await extractRuns(buffer);

  const fullText = pages
    .map((page) => groupRows(page).map((row) => row.map((w) => w.str).join(" ")).join(" "))
    .join(" ");

  const quoteMatch = fullText.match(/Q(?:uo|o)tation\s*#\s*(Q[\w-]+)/i);
  const quoteNumber = quoteMatch ? quoteMatch[1] : null;
  const dateMatch = fullText.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/,
  );
  const date = dateMatch ? dateMatch[0] : null;

  // Customer name / location sit in the left column of the header block, above "ITEM #".
  // The same rows also carry the date/quote# in the right column — restrict to x < 300
  // so those don't bleed into the name/address text.
  const page1Rows = groupRows((pages[0] ?? []).filter((r) => r.x < 300));
  let customerName = "";
  let location = "";
  for (const row of page1Rows) {
    const text = row.map((w) => w.str).join(" ").trim();
    if (/^ITEM\s*#/i.test(text)) break;
    if (!text || /Q(?:uo|o)tation|South National Highway|Cel No|AZARRAGA/i.test(text)) continue;
    if (!customerName) customerName = text;
    else if (!location) location = text;
  }

  const items: ParsedLineItem[] = [];
  for (const page of pages) {
    const clusters = clusterItems(page);
    for (const cluster of clusters) {
      const item = parseCluster(cluster);
      if (item) items.push(item);
    }
  }

  const computedSubtotal = items.reduce((s, it) => s + it.subtotal, 0);
  // Grand-total labels only — exclude "Sub Total ..." (which also contains the word "Total").
  // Some invoices print more than one "Total ₱ X" (e.g. a single PDF holding two separate
  // quotations back to back) — sum every real grand-total found, not just the first.
  const grandTotalMatches = [...fullText.matchAll(/(?<!Sub )Total\s*(?:₱|P)?\s*([\d,]+\.\d{2})/gi)];
  // Some invoices print no labeled grand total at all — just "Sub Total", a "Delivery" line,
  // then a bare final number. Fall back to Sub Total + Delivery in that case.
  const subTotalMatch = fullText.match(/Sub\s*Total\s*(?:₱|P)?\s*([\d,]+\.\d{2})/i);
  const deliveryLabelMatch = fullText.match(
    /Delivery(?:\s+and\s+Install\w*)?(?:\s*Cost)?\s*(?:₱|P)?\s*([\d,]+\.\d{2})/i,
  );
  let total: number | null;
  if (grandTotalMatches.length) {
    total = grandTotalMatches.reduce((s, m) => s + toNumber(m[1]), 0);
  } else if (subTotalMatch) {
    total = toNumber(subTotalMatch[1]) + (deliveryLabelMatch ? toNumber(deliveryLabelMatch[1]) : 0);
  } else {
    total = null;
  }
  const delivery = total && total - computedSubtotal > 0.5 ? Math.round((total - computedSubtotal) * 100) / 100 : 0;

  return {
    customerName,
    location,
    quoteNumber,
    date,
    items,
    subtotal: computedSubtotal,
    delivery,
    total,
    totalsReconciled: total !== null && Math.abs(total - (computedSubtotal + delivery)) < 0.5,
  };
}
