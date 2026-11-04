import type { DocumentGraph } from "./documents";

/** Explicit, development-only fixtures. Never substitute for a configured database. */
export function isLocalPreview() {
  return process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_LOCAL_PREVIEW === "1" && !process.env.DATABASE_URL;
}

export function previewDocuments(): DocumentGraph[] {
  return (["quote", "invoice"] as const).map((type) => {
    const id = type === "quote" ? "preview-quote" : "preview-invoice";
    const createdAt = new Date("2026-11-04T00:00:00Z");
    return {
      id, type, number: `${type === "quote" ? "Q" : "INV"}2026-PREVIEW`,
      revision: 0, status: type === "quote" ? "draft" : "sent", clientId: "preview-client",
      projectName: "Sample residential project", projectAddress: "Palawan",
      issueDate: "2026-11-04", dueDate: "2026-12-04", currency: "PHP",
      vatMode: "none", vatRate: 12, discountType: "percent", discountPercent: 0,
      discountFixed: 0, extraCharges: [], depositPercent: 70,
      leadTime: "30–45 working days", acceptedSectionId: null,
      subtotal: 2500000, discountAmount: 0, chargesTotal: 0, vatAmount: 0,
      total: 2500000, amountPaid: 0, notes: "Sample data for layout review only.",
      terms: "70% deposit, balance upon completion.", shareToken: id,
      sentAt: null, viewedAt: null, acceptedAt: null, convertedFromId: null,
      createdBy: null, createdAt, updatedAt: createdAt,
      client: { id: "preview-client", name: "Sample Customer", contactPerson: null,
        email: null, phone: null, address: "Palawan", tin: null, notes: null,
        archived: false, createdAt },
      sections: [{ id: `${id}-section`, documentId: id, position: 0,
        title: null, kind: "included", note: null,
        lines: [{ id: `${id}-line`, documentId: id, sectionId: `${id}-section`,
          position: 0, itemId: null, code: "W1", description: "2-panel sliding window, aluminum frame, 6mm clear glass",
          unit: "set", pricingMode: "per_unit", areaUnit: "sqm", widthMm: 1200,
          heightMm: 1500, lengthMm: null, minArea: 0, quantity: 2,
          unitPrice: 1250000, options: [], specKey: null, lineTotal: 2500000,
          productId: null, seriesId: null, inputUnit: "m", glass: null, finish: null,
          notes: null, designJson: null, designSvg: null }],
      }],
    };
  });
}
