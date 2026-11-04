import { computeDocument, computeLine } from "./calc";
import { calcInputFrom, type ClientDraft, type DocumentDraft, type DocumentGraph, type Settings } from "./documents";
import { formatDocumentNumber } from "./describe";
import type { Client, Payment } from "./db/schema";

type State = { docs: Map<string, DocumentGraph>; clients: Map<string, Client>; sequences: Map<string, number>; settings: Settings | null; payments: Map<string,Payment> };
const root = globalThis as typeof globalThis & { azarragaDocumentMemory?: State };
export const memory = root.azarragaDocumentMemory ??= { docs: new Map(), clients: new Map(), sequences: new Map(), settings: null, payments:new Map() };
memory.payments ??= new Map();

export const usesDocumentMemory = () => !process.env.DATABASE_URL && process.env.NODE_ENV !== "production";

export function memoryClient(draft: ClientDraft): string {
  const id = draft.id ?? crypto.randomUUID();
  const current = memory.clients.get(id);
  memory.clients.set(id, { id, name: draft.name.trim(), contactPerson: draft.contactPerson ?? null,
    email: draft.email ?? null, phone: draft.phone ?? null, address: draft.address ?? null,
    tin: draft.tin ?? null, notes: draft.notes ?? null, archived: false, createdAt: current?.createdAt ?? new Date() });
  return id;
}

export function memoryNumber(type: "quote" | "invoice", settings: Settings, year: number, claim: boolean) {
  const key = `${type}:${year}`;
  const seq = (memory.sequences.get(key) ?? 0) + Math.max(1, settings.numberStep);
  if (claim) memory.sequences.set(key, seq);
  return formatDocumentNumber({ pattern: settings.numberPattern, prefix: type === "quote" ? settings.quotePrefix : settings.invoicePrefix, year, seq, pad: settings.numberPad });
}

export function memoryWrite(draft: DocumentDraft, settings: Settings, id?: string) {
  const current = id ? memory.docs.get(id) : null;
  if (id && !current) throw new Error("Document not found");
  const docId = id ?? crypto.randomUUID();
  const clientId = memoryClient(draft.client);
  const source = {
    vatMode: current?.vatMode ?? draft.vatMode ?? settings.vatMode,
    vatRate: current?.vatRate ?? draft.vatRate ?? Number(settings.vatRate),
    discountType: draft.discountType ?? "percent" as const,
    discountPercent: draft.discountPercent ?? 0, discountFixed: draft.discountFixed ?? 0,
    extraCharges: draft.extraCharges ?? [], depositPercent: draft.depositPercent ?? Number(settings.defaultDepositPercent),
    acceptedSectionId: draft.acceptedSectionId ?? null, amountPaid: current?.amountPaid ?? 0,
  };
  const sections = draft.sections.map((section) => ({ ...section, id: section.id ?? crypto.randomUUID() }));
  const totals = computeDocument(calcInputFrom(sections, source));
  const type = current?.type ?? draft.type ?? "quote";
  const issueDate = draft.issueDate ?? new Date().toISOString().slice(0, 10);
  const doc: DocumentGraph = {
    id: docId, type, number: current?.number ?? draft.forcedNumber ?? memoryNumber(type, settings, new Date().getFullYear(), true),
    revision: current?.revision ?? 0, status: current?.status ?? "draft", clientId,
    projectName: draft.projectName ?? null, projectAddress: draft.projectAddress ?? null,
    issueDate, dueDate: draft.dueDate ?? null, currency: current?.currency ?? draft.currency ?? settings.currency,
    ...source, subtotal: totals.subtotal, discountAmount: totals.discountAmount,
    chargesTotal: totals.chargesTotal, vatAmount: totals.vatAmount, total: totals.total,
    leadTime: draft.leadTime ?? settings.defaultLeadTime, notes: draft.notes ?? null,
    terms: draft.terms ?? settings.defaultQuoteTerms, shareToken: current?.shareToken ?? crypto.randomUUID().replaceAll("-", ""),
    sentAt: current?.sentAt ?? null, viewedAt: current?.viewedAt ?? null, acceptedAt: current?.acceptedAt ?? null,
    convertedFromId: current?.convertedFromId ?? null, createdBy: "owner",
    createdAt: current?.createdAt ?? new Date(), updatedAt: new Date(), client: structuredClone(memory.clients.get(clientId)!),
    sections: sections.map((section, position) => ({
      id: section.id, documentId: docId, position, title: section.title ?? null, kind: section.kind ?? "included", note: section.note ?? null,
      lines: section.lines.map((line, linePosition) => ({
        id: crypto.randomUUID(), documentId: docId, sectionId: section.id, position: linePosition,
        itemId: line.itemId ?? null, code: line.code ?? null, description: line.description,
        unit: line.unit ?? "set", pricingMode: line.pricingMode ?? "per_unit", areaUnit: line.areaUnit ?? "sqm",
        widthMm: line.widthMm ?? null, heightMm: line.heightMm ?? null, lengthMm: line.lengthMm ?? null,
        minArea: line.minArea ?? 0, quantity: line.quantity ?? 1, unitPrice: line.unitPrice ?? 0,
        options: line.options ?? [], specKey: null,
        productId: line.productId ?? null, seriesId: line.seriesId ?? null, inputUnit: line.inputUnit ?? "m",
        glass: line.glass ?? null, finish: line.finish ?? null, notes: line.notes ?? null,
        designJson: line.designJson ?? null, designSvg: line.designSvg ?? null,
        lineTotal: computeLine({ pricingMode: line.pricingMode ?? "per_unit", unitPrice: line.unitPrice ?? 0,
          quantity: line.quantity ?? 1, widthMm: line.widthMm, heightMm: line.heightMm,
          areaUnit: line.areaUnit, minArea: line.minArea, options: line.options }).lineTotal,
      })),
    })),
  };
  memory.docs.set(docId, structuredClone(doc));
  return { id: docId, totals };
}
