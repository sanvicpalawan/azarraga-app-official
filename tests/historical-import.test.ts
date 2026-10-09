/**
 * Guards the historical import: every quotation that came off paper must sit
 * in the database with the exact total that was printed on it.
 *
 * Skipped automatically when DATABASE_URL is not available.
 *
 * Run:  pnpm import:history --write   first, then pnpm test
 */
import { describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no local env file */
  }
}

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

/** Totals exactly as printed on the original PDFs, in centavos. */
const PRINTED_TOTALS: Record<string, number> = {
  "Q2026-660": 31_153_000, // EM Abin Trading
  "Q2026-585": 8_680_000, // Ar Mark
  "Q2026-575": 5_720_000, // Charlie (55,200 + 2,000 delivery)
  "Q2026-535": 53_991_000, // Marlon Vivas - their sheet printed no total
  "Q2026-605": 2_132_000, // Oliver
  "Q2026-635": 1_560_000, // Pajara
  "Q2026-630": 2_480_000, // Ranchero
  "Q2026-580": 5_830_000, // Rey Felizarte (subtotal wraps to its own row)
  "Q2026-615": 30_129_000, // Shena (295,290 + 6,000 delivery)
  "Q2026-600": 5_372_000, // TCCPOWERSERVE
  "Q2026-645": 7_115_000, // Tara Hostel (66,150 + 5,000 delivery)
  "Q2026-620": 2_802_000, // Tagusao Construction
};

/** Joriz carries two option tables, so the document total stays at zero. */
const JORIZ_NUMBER = "Q2026-655";
const JORIZ_OPTION_TOTALS = [2_088_000, 5_584_000];

describeDb("historical quotations (live database)", () => {
  it("holds every imported quotation with its printed total", async () => {
    const { listDocuments } = await import("../lib/documents");
    const quotes = await listDocuments({ type: "quote" });
    const byNumber = new Map(quotes.map((q) => [q.number, q]));

    for (const [number, total] of Object.entries(PRINTED_TOTALS)) {
      const quote = byNumber.get(number);
      expect(quote, `${number} is missing`).toBeDefined();
      expect(Number(quote!.total), `${number} total`).toBe(total);
    }
  });

  it("keeps both Joriz options as separate, correct totals", async () => {
    const { listDocuments, loadDocument } = await import("../lib/documents");
    const quotes = await listDocuments({ type: "quote" });
    const joriz = quotes.find((q) => q.number === JORIZ_NUMBER);
    expect(joriz, "Joriz quotation is missing").toBeDefined();

    // No option picked yet, so the document itself totals nothing.
    expect(Number(joriz!.total)).toBe(0);

    const graph = await loadDocument(joriz!.id);
    expect(graph?.sections).toHaveLength(2);

    const optionTotals = graph!.sections.map((s) =>
      s.lines.reduce((sum, line) => sum + Number(line.lineTotal), 0),
    );
    expect(optionTotals).toEqual(JORIZ_OPTION_TOTALS);
  });

  it("numbers the next new quotation above the imported history", async () => {
    const { peekNextDocumentNumber, listDocuments } = await import("../lib/documents");
    const next = await peekNextDocumentNumber("quote", 2026);
    const quotes = await listDocuments({ type: "quote" });
    const numbers = quotes.map((q) => Number(q.number.split("-").pop()));

    expect(numbers.length).toBeGreaterThanOrEqual(13);
    expect(Number(next.split("-").pop())).toBeGreaterThan(Math.max(...numbers));
  });
});
