/**
 * End-to-end check of the write path: a draft goes in, and the totals that
 * come back are the ones lib/calc.ts says they should be - never the ones
 * the client sent.
 *
 * Skipped automatically when DATABASE_URL is not available, so `pnpm test`
 * stays green in CI. Rows created here are deleted again afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// tsx/next read .env.local; vitest does not.
try {
  if (!process.env.DATABASE_URL) process.loadEnvFile(".env.local");
} catch {
  /* no local env file */
}

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("documents round trip (live database)", () => {
  let documents: typeof import("../lib/documents");
  const created: string[] = [];

  const draft = (overrides: Record<string, unknown> = {}) => ({
    type: "quote" as const,
    client: { name: "Vitest Client", phone: "09170000000" },
    projectName: "Smoke Test Project",
    vatMode: "none" as const,
    vatRate: 0,
    discountType: "percent" as const,
    discountPercent: 0,
    discountFixed: 0,
    depositPercent: 70,
    sections: [
      {
        title: null,
        kind: "included" as const,
        lines: [
          {
            description: "798 Series 2 Panel Sliding Window, HA Frame, 6mm Annealed Clear Glass, 1.50 x 2.10",
            unit: "set",
            quantity: 2,
            unitPrice: 2888000, // centavos: 28,880.00
            widthMm: 1500,
            heightMm: 2100,
            pricingMode: "per_unit" as const,
          },
        ],
      },
    ],
    ...overrides,
  });

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    documents = await import("../lib/documents");
  });

  afterAll(async () => {
    if (!documents) return;
    const { getRawSql } = await import("../lib/db/client");
    const raw = getRawSql();
    for (const id of created) {
      await raw`delete from documents where id = ${id}`;
    }
    await raw`delete from clients where name = 'Vitest Client'`;
  });

  it("recomputes totals server-side instead of trusting the client", async () => {
    const id = await documents!.createDocument(draft());
    created.push(id);

    const graph = await documents!.loadDocument(id);
    expect(graph).not.toBeNull();

    // 28,880.00 x 2
    expect(graph!.total).toBe(5776000);
    expect(graph!.subtotal).toBe(5776000);
    expect(graph!.vatAmount).toBe(0);
    expect(graph!.sections[0]!.lines[0]!.lineTotal).toBe(5776000);
    expect(graph!.sections[0]!.lines[0]!.quantity).toBe(2);
  });

  it("mints a numbered quote and a share token", async () => {
    const id = await documents!.createDocument(draft());
    created.push(id);
    const graph = await documents!.loadDocument(id);

    expect(graph!.number).toMatch(/^Q\d{4}-\d+$/);
    expect(graph!.shareToken).toMatch(/^[0-9a-f]{32}$/);
    expect(graph!.type).toBe("quote");
    expect(graph!.status).toBe("draft");
    // currency and VAT are snapshotted onto the document
    expect(graph!.currency).toBe("PHP");
    expect(graph!.vatMode).toBe("none");
  });

  it("applies a discount and then the delivery charge", async () => {
    const id = await documents!.createDocument(
      draft({
        sections: [
          {
            kind: "included",
            lines: [{ description: "Test line", unit: "set", quantity: 1, unitPrice: 10000000 }],
          },
        ],
        discountType: "percent",
        discountPercent: 10,
        extraCharges: [{ label: "Delivery", amount: 600000 }],
      }),
    );
    created.push(id);

    const graph = await documents!.loadDocument(id);
    // 100,000 - 10,000 + 6,000
    expect(graph!.discountAmount).toBe(1000000);
    expect(graph!.chargesTotal).toBe(600000);
    expect(graph!.total).toBe(9600000);
  });

  it("gives every duplicate its own number", async () => {
    const original = await documents!.createDocument(draft());
    created.push(original);
    const copyId = await documents!.duplicateDocument(original);
    created.push(copyId);

    const a = await documents!.loadDocument(original);
    const b = await documents!.loadDocument(copyId);

    expect(b!.number).not.toBe(a!.number);
    expect(b!.shareToken).not.toBe(a!.shareToken);
    expect(b!.total).toBe(a!.total);
  });

  it("converts a quote to a 70% deposit invoice", async () => {
    const quoteId = await documents!.createDocument(draft());
    created.push(quoteId);

    const invoiceId = await documents!.convertQuoteToInvoice(quoteId);
    created.push(invoiceId);

    const quote = await documents!.loadDocument(quoteId);
    const invoice = await documents!.loadDocument(invoiceId);

    expect(invoice!.type).toBe("invoice");
    expect(invoice!.number).not.toBe(quote!.number);
    expect(invoice!.convertedFromId).toBe(quoteId);
    expect(invoice!.total).toBe(quote!.total);
    expect(invoice!.depositPercent).toBe(70);
    expect(quote!.status).toBe("accepted");
  });

  it("records a GCash payment and updates the balance", async () => {
    const invoiceId = await documents!.createDocument(
      draft({ type: "invoice", status: "unpaid" }),
    );
    created.push(invoiceId);

    await documents!.recordPayment({
      documentId: invoiceId,
      amount: 4043200, // 70% of 57,760.00
      method: "gcash",
      reference: "GCASH-TEST-1",
    });

    const invoice = await documents!.loadDocument(invoiceId);
    expect(invoice!.amountPaid).toBe(4043200);
    expect(invoice!.status).toBe("partial");

    await documents!.recordPayment({
      documentId: invoiceId,
      amount: 5776000 - 4043200,
      method: "cash",
    });
    const paid = await documents!.loadDocument(invoiceId);
    expect(paid!.amountPaid).toBe(5776000);
    expect(paid!.status).toBe("paid");

    const rows = await documents!.listPayments(invoiceId);
    expect(rows).toHaveLength(2);
  });

  it("survives a save that replaces every section", async () => {
    const id = await documents!.createDocument(draft());
    created.push(id);

    await documents!.saveDocument(
      id,
      draft({
        sections: [
          {
            kind: "included",
            title: null,
            lines: [
              { description: "Line one", unit: "set", quantity: 1, unitPrice: 100000 },
              { description: "Line two", unit: "set", quantity: 3, unitPrice: 250000 },
            ],
          },
        ],
      }),
    );

    const graph = await documents!.loadDocument(id);
    expect(graph!.sections).toHaveLength(1);
    expect(graph!.sections[0]!.lines).toHaveLength(2);
    expect(graph!.total).toBe(100000 + 750000);
  });
});
