/**
 * Imports the quotations the shop already sent on paper, so history lives in
 * the same list as anything created from now on.
 *
 * Source of truth: the text dump of the original invoice PDFs
 *   %TEMP%/invoices-dump.txt
 *
 * Nothing is trusted blindly - every printed line is re-added and compared
 * against the total on the paper. A mismatch stops the import instead of
 * writing a wrong number into the database.
 *
 * Run:  pnpm import:history           (dry run)
 *       pnpm import:history --write   (writes to Neon)
 */
import { readFile } from "node:fs/promises";
import {
  advanceDocumentSequence,
  createDocument,
  listDocuments,
  type DocumentDraft,
} from "../lib/documents";

// tsx does not read .env.local the way next dev does.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no local env file - DATABASE_URL may already be in the environment */
  }
}

/* ------------------------------------------------------------------ */
/* Text dump parsing                                                   */
/* ------------------------------------------------------------------ */

interface Run {
  x: number;
  y: number;
  text: string;
}
interface Row {
  y: number;
  runs: Run[];
}

interface PdfItem {
  code: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number; // centavos
  lineTotal: number; // centavos
}

interface PdfBlock {
  items: PdfItem[];
  charges: { label: string; amount: number }[];
  subtotalPdf: number;
  totalPdf: number;
  printedTotal: boolean;
}

/** While parsing, rows still carry their position so prose can be attached. */
interface RawBlock extends Omit<PdfBlock, "items"> {
  items: ItemRow[];
}

interface ParsedQuote {
  file: string;
  number: string;
  customer: string;
  location: string;
  date: string;
  leadTime: string | null;
  terms: string | null;
  blocks: PdfBlock[];
}

const MONEY = /^-?[\d,]+\.\d{2}$/;
const NUM = /^-?[\d,.]+$/;
const CODE = /^[A-Za-z]{1,3}\d*$/;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const LETTERHEAD = /AZARRAGA GLASS|South National Highway|Cel No\./;

const toCents = (s: string): number =>
  Math.round(parseFloat(s.replace(/,/g, "")) * 100);

function splitBlocks(dump: string): { file: string; lines: string[] }[] {
  const out: { file: string; lines: string[] }[] = [];
  let cur: { file: string; lines: string[] } | null = null;
  for (const line of dump.split(/\r?\n/)) {
    const m = line.match(/^FILE:\s+(.*?)\s+\(\d+ page/);
    if (m) {
      cur = { file: m[1]!, lines: [] };
      out.push(cur);
      continue;
    }
    cur?.lines.push(line);
  }
  return out;
}

function parseRows(lines: string[]): Row[] {
  const rows: Row[] = [];
  for (const line of lines) {
    if (!line.trimStart().startsWith("[")) continue;
    const runs: Run[] = [];
    const re = /\[(\d+),(\d+)\]\s*([^|]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const text = (m[3] ?? "").trim();
      if (!text) continue;
      runs.push({ x: Number(m[1]), y: Number(m[2]), text });
    }
    if (runs.length) rows.push({ y: runs[0]!.y, runs });
  }
  return rows;
}

/** Text that belongs to a description rather than a code or a number. */
const isDescriptionText = (t: string): boolean =>
  t.length >= 3 && !MONEY.test(t) && !NUM.test(t) && !CODE.test(t);

interface ItemRow {
  row: Row;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  code: string | null;
  hasTotal: boolean;
}

const freshBlock = (): RawBlock => ({
  items: [],
  charges: [],
  subtotalPdf: 0,
  totalPdf: 0,
  printedTotal: false,
});

function parseQuote(file: string, lines: string[]): ParsedQuote | null {
  const rows = parseRows(lines);
  const firstHeader = rows.findIndex((r) => r.runs.some((x) => x.text === "ITEM #"));
  if (firstHeader < 0) return null; // not one of their documents
  const headerY = rows[firstHeader]!.y;

  /* ---- letterhead: customer, site, date, quotation number ---- */
  const above = rows
    .slice(0, firstHeader)
    .filter((r) => r.runs.some((x) => x.x <= 30 && x.y > headerY))
    .sort((a, b) => b.y - a.y);
  const headRuns = rows.slice(0, firstHeader).flatMap((r) => r.runs);

  const customer = above[0]?.runs.find((x) => x.x <= 30)?.text ?? "";
  const location = above[1]?.runs.find((x) => x.x <= 30)?.text ?? "";
  const date =
    headRuns.find((x) => x.x >= 460 && MONTHS.some((m) => x.text.startsWith(m)))?.text ?? "";
  const number =
    headRuns
      .find((x) => /Qotation\s*#|Quotation\s*#|Invoice\s*#/i.test(x.text))
      ?.text.replace(/^.*#\s*/, "")
      .trim() ?? "";
  if (!number || !customer) return null;

  /* ---- body stops at the payment-terms block ---- */
  let end = rows.length;
  for (let i = firstHeader + 1; i < rows.length; i++) {
    if (rows[i]!.runs.some((r) => /^Payment Terms:?$/i.test(r.text))) {
      end = i;
      break;
    }
  }

  /* ---- their verbatim terms, kept per quotation ---- */
  const terms = rows
    .slice(end)
    .filter((r) => r.runs.some((x) => x.x <= 30))
    .map((r) => r.runs.find((x) => x.x <= 30)!.text)
    .filter((t) => !/^Payment Terms:?$/i.test(t))
    .join("\n");
  const leadMatch = terms.match(/Lead Time:\s*(.+?working days)/i);

  /* ---- one block per ITEM # table; Joriz carries two option tables ---- */
  const raw: RawBlock[] = [];
  let cur = freshBlock();
  let lastItem: ItemRow | null = null;

  for (let i = firstHeader; i < end; i++) {
    const row = rows[i]!;
    const texts = row.runs.map((r) => r.text);

    if (texts.includes("ITEM #")) {
      if (cur.items.length) raw.push(cur);
      cur = freshBlock();
      lastItem = null;
      continue;
    }
    if (texts.some((t) => LETTERHEAD.test(t))) continue;

    const moneyHigh = row.runs.find((r) => r.x >= 600 && MONEY.test(r.text));
    const qtyRun = row.runs.find((r) => r.x >= 415 && r.x < 448 && NUM.test(r.text));
    const unitRun = row.runs.find(
      (r) => r.x >= 448 && r.x < 500 && /^(sets?|LM|pcs|roll|pc)$/i.test(r.text),
    );
    const costRun = row.runs.find((r) => r.x >= 480 && r.x < 600 && MONEY.test(r.text));
    // Keep only runs that contain letters: that drops the ₱ symbol without
    // depending on how the console or the file encodes it.
    const label = row.runs
      .filter((r) => !MONEY.test(r.text) && !NUM.test(r.text) && /[A-Za-z]/.test(r.text))
      .map((r) => r.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (qtyRun && unitRun && costRun) {
      const codeRun =
        row.runs.find((r) => r.x <= 45 && CODE.test(r.text) && (/\d/.test(r.text) || r.text.length === 2)) ??
        null;
      const item: ItemRow = {
        row,
        qty: parseFloat(qtyRun.text.replace(/,/g, "")),
        unit: unitRun.text.toLowerCase() === "sets" ? "sets" : unitRun.text,
        unitPrice: toCents(costRun.text),
        lineTotal: moneyHigh ? toCents(moneyHigh.text) : 0,
        code: codeRun?.text ?? null,
        hasTotal: Boolean(moneyHigh),
      };
      cur.items.push(item);
      lastItem = item;
      continue;
    }

    if (!moneyHigh) continue;
    const amount = toCents(moneyHigh.text);

    // Their sheet sometimes wraps the subtotal onto the next line (Rey).
    if (lastItem && !lastItem.hasTotal && !label) {
      lastItem.lineTotal = amount;
      lastItem.hasTotal = true;
      continue;
    }

    if (/sub\s*total/i.test(label)) {
      cur.subtotalPdf = amount;
    } else if (/^total$/i.test(label)) {
      cur.totalPdf = amount;
      cur.printedTotal = true;
    } else if (/delivery|installation|labou?r/i.test(label)) {
      cur.charges.push({ label, amount });
    } else if (!label) {
      cur.totalPdf = amount;
      cur.printedTotal = true;
    }
  }
  if (cur.items.length) raw.push(cur);
  if (!raw.length) return null;

  /* ---- descriptions: every leftover text line joins its nearest item ---- */
  const itemRows = raw.flatMap((b) => b.items);
  const descs: { y: number; text: string }[] = [];
  for (let i = firstHeader; i < end; i++) {
    const row = rows[i]!;
    const texts = row.runs.map((r) => r.text);
    if (texts.includes("ITEM #") || texts.some((t) => LETTERHEAD.test(t))) continue;

    const isItemRow = itemRows.some((it) => it.row === row);
    const hasMoney = row.runs.some((r) => r.x >= 600 && MONEY.test(r.text));
    if (hasMoney && !isItemRow) continue; // totals rows hold labels, not prose

    for (const r of row.runs) {
      if (r.x < 20 || r.x > 420) continue;
      if (isDescriptionText(r.text)) descs.push({ y: r.y, text: r.text });
    }
  }

  const blocks: PdfBlock[] = raw.map((block) => {
    const ys = block.items.map((i) => i.row.y);
    const lo = Math.min(...ys) - 46;
    const hi = Math.max(...ys) + 46;
    const mine = descs.filter((d) => d.y >= lo && d.y <= hi);

    const items: PdfItem[] = block.items.map((item) => {
      const ordered = mine
        .filter((d) => Math.abs(d.y - item.row.y) <= 46)
        .sort((a, b) => Math.abs(a.y - item.row.y) - Math.abs(b.y - item.row.y))
        .slice(0, 6)
        .sort((a, b) => b.y - a.y)
        .map((d) => d.text);
      return {
        code: item.code,
        description: joinWords(ordered),
        quantity: item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      };
    });

    fillMissingCodes(items);

    return {
      items,
      charges: block.charges,
      subtotalPdf: block.subtotalPdf,
      totalPdf: block.totalPdf,
      printedTotal: block.printedTotal,
    };
  });

  return {
    file: file.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, ""),
    number,
    customer,
    location,
    date,
    leadTime: leadMatch ? leadMatch[1]!.trim() : null,
    terms: terms || null,
    blocks,
  };
}

/** Their Marlon sheet only printed BD1; the rest carry the same prefix. */
function fillMissingCodes(items: PdfItem[]): void {
  let prefix: string | null = null;
  let n = 0;
  for (const item of items) {
    const m = item.code?.match(/^([A-Za-z]+)(\d*)$/);
    if (m) {
      prefix = m[1]!;
      n = m[2] ? parseInt(m[2], 10) : n + 1;
      continue;
    }
    if (prefix) {
      n += 1;
      item.code = `${prefix}${n}`;
    }
  }
}

/** "Glass, 1.50" + "x 2.10" -> "Glass, 1.50 x 2.10"; "Opt 1" gets a comma. */
function joinWords(parts: string[]): string {
  let out = "";
  for (const p of parts) {
    if (!out) out = p;
    else if (/^Opt\s/i.test(p)) out += `, ${p}`;
    else if (/[,:]$/.test(out)) out += ` ${p}`;
    else out += ` ${p}`;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** "September 10, 2026" -> "2026-09-10" */
function isoDate(human: string): string | undefined {
  const d = new Date(human);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Verification + import                                               */
/* ------------------------------------------------------------------ */

interface Check {
  ok: boolean;
  detail: string;
}

function check(q: ParsedQuote): Check {
  const notes: string[] = [];
  let ok = true;

  for (const [i, block] of q.blocks.entries()) {
    const sum = block.items.reduce((s, it) => s + it.lineTotal, 0);
    const charges = block.charges.reduce((s, c) => s + c.amount, 0);

    if (block.subtotalPdf && block.subtotalPdf !== sum) {
      ok = false;
      notes.push(
        `option ${i + 1}: lines add to ${sum}, paper says ${block.subtotalPdf}`,
      );
    }
    if (block.printedTotal && block.totalPdf !== sum + charges) {
      ok = false;
      notes.push(
        `option ${i + 1}: lines+charges = ${sum + charges}, paper total ${block.totalPdf}`,
      );
    }
    if (!block.printedTotal) {
      notes.push(`option ${i + 1}: paper has no total row (using ${sum + charges})`);
    }
  }
  return { ok, detail: notes.join("; ") };
}

function toDraft(q: ParsedQuote): DocumentDraft {
  const many = q.blocks.length > 1;

  return {
    type: "quote",
    forcedNumber: q.number,
    status: "sent",
    client: { name: q.customer },
    projectName: q.file,
    projectAddress: q.location || null,
    issueDate: isoDate(q.date),
    leadTime: q.leadTime,
    terms: q.terms,
    sections: q.blocks.map((block, i) => ({
      title: many ? `Option ${String.fromCharCode(65 + i)}` : null,
      kind: many ? ("alternative" as const) : ("included" as const),
      lines: block.items.map((it) => ({
        code: it.code,
        description: it.description || "Item",
        unit: it.unit,
        pricingMode: "per_unit" as const,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })),
    extraCharges: many ? [] : q.blocks[0]?.charges ?? [],
  };
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const dumpPath =
    process.argv.find((a) => a.toLowerCase().endsWith(".txt")) ??
    `${process.env.TEMP ?? "/tmp"}/invoices-dump.txt`;

  const dump = await readFile(dumpPath, "utf8");
  const parsed = splitBlocks(dump)
    .map((b) => parseQuote(b.file, b.lines))
    .filter((q): q is ParsedQuote => q !== null);

  if (!parsed.length) {
    console.error(`No quotations found in ${dumpPath}`);
    process.exit(1);
  }

  const existing = new Set(
    (await listDocuments({ type: "quote" })).map((d) => d.number),
  );

  let ready = 0;
  let failed = 0;
  let skipped = 0;

  for (const q of parsed) {
    const result = check(q);
    if (!result.ok) {
      failed += 1;
      console.log(`\nMISMATCH ${q.number} (${q.customer})\n  ${result.detail}`);
      continue;
    }

    if (existing.has(q.number)) {
      skipped += 1;
      console.log(`  = ${q.number}  ${q.customer} already imported`);
      continue;
    }

    const total = q.blocks.reduce(
      (s, b) => s + b.items.reduce((t, i) => t + i.lineTotal, 0) + b.charges.reduce((t, c) => t + c.amount, 0),
      0,
    );
    const lineCount = q.blocks.reduce((s, b) => s + b.items.length, 0);

    console.log(
      `  ${write ? "+" : "~"} ${q.number.padEnd(10)} ${q.customer.slice(0, 25).padEnd(26)}` +
        `${String(lineCount).padStart(2)} lines  ` +
        `${q.blocks.length > 1 ? `${q.blocks.length} options  ` : ""}` +
        `${String(total).padStart(9)} cents  ${q.date}${result.detail ? `  (${result.detail})` : ""}`,
    );

    if (write) await createDocument(toDraft(q));
    ready += 1;
  }

  // Keep numbering above everything the shop has already handed out.
  const highest = parsed.reduce((max, q) => {
    const n = Number(q.number.split("-").pop());
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const year = Number(
    parsed[0]?.number.split("-")[0]?.replace(/\D/g, "") || new Date().getFullYear(),
  );

  if (write && highest) {
    await advanceDocumentSequence("quote", year, highest + 5);
    console.log(`\nNext quotation starts above Q${year}-${highest + 5}`);
  }

  console.log(
    `\n${write ? "Imported" : "Ready"}: ${ready}  skipped: ${skipped}  mismatches: ${failed}`,
  );
  if (failed) process.exit(1);
}

await main();
