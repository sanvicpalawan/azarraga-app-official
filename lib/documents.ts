/**
 * Server-side document logic for quotes and invoices.
 *
 * Two hard rules are enforced here and nowhere else:
 *   1. Money is integer centavos. Every total in this file is recomputed
 *      with lib/calc.ts before it is written. Client-supplied totals are
 *      never trusted - they are simply ignored.
 *   2. Currency, VAT and prices are snapshotted onto the document at
 *      creation. Changing company settings later never rewrites history.
 *
 * Server actions and API routes both call into this module.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  computeDocument,
  computeLine,
  paymentStatus,
  type Charge,
  type DocumentInput,
  type DocumentResult,
  type SectionInput,
} from "./calc";
import { formatDocumentNumber } from "./describe";
import { getDrizzle, getRawSql, readyDocumentSchema } from "./db/client";
import { memory, memoryClient, memoryNumber, memoryWrite, usesDocumentMemory } from "./document-memory";
import { assertQuoteTransition } from "./quote-lifecycle";
import { validateDocumentDraft } from "./document-validation";
import { isLocalPreview, previewDocuments } from "./local-preview";
import {
  clients,
  companySettings,
  documentLines,
  documentSections,
  documents,
  numberSequences,
  payments,
  type Client,
  type CompanySettings,
  type Document,
  type DocumentLine,
  type DocumentSection,
  type ExtraCharge,
  type LineOptionSnapshot,
} from "./db/schema";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export type DocType = "quote" | "invoice";

export function randomToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const today = (): string => new Date().toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Company settings                                                    */
/* ------------------------------------------------------------------ */

export type Settings = Pick<
  CompanySettings,
  | "id"
  | "name"
  | "address"
  | "phone"
  | "email"
  | "tin"
  | "logoDataUrl"
  | "currency"
  | "vatMode"
  | "vatRate"
  | "quotePrefix"
  | "invoicePrefix"
  | "numberPattern"
  | "numberStep"
  | "numberPad"
  | "quoteValidityDays"
  | "paymentTermsDays"
  | "defaultDepositPercent"
  | "defaultLeadTime"
  | "defaultQuoteTerms"
  | "defaultInvoiceTerms"
  | "defaultNotes"
  | "paymentInstructions"
> &
  Record<string, unknown>;

/** Sensible defaults so the app still renders before the seed has run. */
const SETTINGS_DEFAULTS = {
  id: 1,
  name: "Azarraga Glass & Aluminum",
  address: null as string | null,
  phone: null as string | null,
  email: null as string | null,
  tin: null as string | null,
  logoDataUrl: null as string | null,
  currency: "PHP" as const,
  vatMode: "none" as const,
  vatRate: 12,
  quotePrefix: "Q",
  invoicePrefix: "INV",
  numberPattern: "{prefix}{year}-{seq}",
  numberStep: 1,
  numberPad: 3,
  quoteValidityDays: 30,
  paymentTermsDays: 15,
  defaultDepositPercent: 70,
  defaultLeadTime: "30-45 working days",
  defaultQuoteTerms: null as string | null,
  defaultInvoiceTerms: null as string | null,
  defaultNotes: null as string | null,
  paymentInstructions: null as string | null,
};

export async function getSettings(): Promise<Settings> {
  if (isLocalPreview()) return { ...SETTINGS_DEFAULTS };
  if (usesDocumentMemory()) return structuredClone(memory.settings ?? SETTINGS_DEFAULTS);
  await readyDocumentSchema();
  const db = getDrizzle();
  const rows = await db.select().from(companySettings).where(eq(companySettings.id, 1)).limit(1);
  return rows[0] ?? { ...SETTINGS_DEFAULTS };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  if (usesDocumentMemory()) { memory.settings = { ...SETTINGS_DEFAULTS, ...memory.settings, ...patch }; return; }
  await readyDocumentSchema();
  const db = getDrizzle();
  const rows = await db.select({ id: companySettings.id }).from(companySettings);
  if (rows.length === 0) {
    await db.insert(companySettings).values({ ...SETTINGS_DEFAULTS, ...patch, id: 1 });
    return;
  }
  await db.update(companySettings).set({ ...patch, updatedAt: new Date() }).where(eq(companySettings.id, 1));
}

/* ------------------------------------------------------------------ */
/* Numbering                                                           */
/* ------------------------------------------------------------------ */

/**
 * Atomically claims the next number for the current year.
 *
 *   insert ... on conflict do update set last = last + step returning last
 *
 * Two people saving at the same instant get different numbers: the
 * increment and the read happen in one statement on the server.
 */
export async function nextDocumentNumber(type: DocType, year = new Date().getFullYear()): Promise<string> {
  if (usesDocumentMemory()) return memoryNumber(type, await getSettings(), year, true);
  await readyDocumentSchema();
  const db = getDrizzle();
  const settings = await getSettings();
  const step = Math.max(Number(settings.numberStep) || 5, 1);
  const prefix = type === "quote" ? settings.quotePrefix : settings.invoicePrefix;

  const res = await db.execute<{ last: number }>(sql`
    insert into number_sequences (type, year, last)
    values (${type}, ${year}, ${step})
    on conflict (type, year) do update set last = number_sequences.last + ${step}
    returning last
  `);
  const seq = Number(res.rows[0]?.last ?? step);

  return formatDocumentNumber({
    pattern: settings.numberPattern,
    prefix,
    year,
    seq,
    pad: settings.numberPad,
  });
}

/** Where the next quote of this year would land. Used by the list header. */
export async function peekNextDocumentNumber(type: DocType, year = new Date().getFullYear()): Promise<string> {
  if (isLocalPreview()) return `${type === "quote" ? "Q" : "INV"}${year}-PREVIEW`;
  if (usesDocumentMemory()) return memoryNumber(type, await getSettings(), year, false);
  const settings = await getSettings();
  const step = Math.max(Number(settings.numberStep) || 5, 1);
  const db = getDrizzle();
  const rows = await db
    .select({ last: numberSequences.last })
    .from(numberSequences)
    .where(and(eq(numberSequences.type, type), eq(numberSequences.year, year)));
  const seq = (rows[0]?.last ?? 0) + step;
  return formatDocumentNumber({
    pattern: settings.numberPattern,
    prefix: type === "quote" ? settings.quotePrefix : settings.invoicePrefix,
    year,
    seq,
    pad: settings.numberPad,
  });
}

/**
 * Moves the counter forward without ever moving it back. Used after
 * importing historical quotations so the next new quote lands above the
 * numbers the shop has already handed out on paper.
 */
export async function advanceDocumentSequence(
  type: DocType,
  year: number,
  seq: number,
): Promise<void> {
  const db = getDrizzle();
  await db.execute(sql`
    insert into number_sequences (type, year, last)
    values (${type}, ${year}, ${seq})
    on conflict (type, year) do update
      set last = greatest(number_sequences.last, excluded.last)
  `);
}

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export interface ClientDraft {
  id?: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tin?: string | null;
  notes?: string | null;
}

export async function upsertClient(draft: ClientDraft): Promise<string> {
  if (usesDocumentMemory()) return memoryClient(draft);
  await readyDocumentSchema();
  const db = getDrizzle();
  if (draft.id) {
    const rows = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, draft.id)).limit(1);
    if (rows.length > 0) {
      await db.update(clients).set(draft as never).where(eq(clients.id, draft.id));
      return draft.id;
    }
  }
  const inserted = await db
    .insert(clients)
    .values({
      name: draft.name,
      contactPerson: draft.contactPerson ?? null,
      email: draft.email ?? null,
      phone: draft.phone ?? null,
      address: draft.address ?? null,
      tin: draft.tin ?? null,
      notes: draft.notes ?? null,
    })
    .returning({ id: clients.id });
  return inserted[0]!.id;
}

export async function listCustomers(): Promise<Client[]> {
  if (isLocalPreview()) return [previewDocuments()[0].client];
  if (usesDocumentMemory()) return structuredClone([...memory.clients.values()]).sort((a,b) => a.name.localeCompare(b.name));
  await readyDocumentSchema();
  return getDrizzle().select().from(clients).where(eq(clients.archived, false)).orderBy(clients.name);
}

/* ------------------------------------------------------------------ */
/* Draft shapes (what the editor posts)                                */
/* ------------------------------------------------------------------ */

export interface LineDraft {
  productId?: number | null;
  seriesId?: number | null;
  inputUnit?: string;
  glass?: string | null;
  finish?: string | null;
  notes?: string | null;
  designJson?: Record<string, unknown> | null;
  designSvg?: string | null;
  id?: string;
  itemId?: string | null;
  code?: string | null;
  description: string;
  unit?: string;
  pricingMode?: "per_unit" | "per_area";
  areaUnit?: "sqft" | "sqm";
  widthMm?: number | null;
  heightMm?: number | null;
  lengthMm?: number | null;
  minArea?: number;
  quantity?: number;
  unitPrice?: number; // centavos
  options?: LineOptionSnapshot[];
}

export interface SectionDraft {
  id?: string;
  title?: string | null;
  kind?: "included" | "alternative";
  note?: string | null;
  lines: LineDraft[];
}

export interface DocumentDraft {
  type?: DocType;
  client: ClientDraft;
  projectName?: string | null;
  projectAddress?: string | null;
  issueDate?: string;
  dueDate?: string | null;
  currency?: CompanySettings["currency"];
  vatMode?: CompanySettings["vatMode"];
  vatRate?: number;
  discountType?: "percent" | "fixed";
  discountPercent?: number;
  discountFixed?: number;
  extraCharges?: ExtraCharge[];
  depositPercent?: number;
  leadTime?: string | null;
  acceptedSectionId?: string | null;
  status?: Document["status"];
  notes?: string | null;
  terms?: string | null;
  sections: SectionDraft[];
  /**
   * Set only when importing history: keeps the number the paper quotation
   * already had instead of taking the next one from the sequence.
   */
  forcedNumber?: string;
}

/* ------------------------------------------------------------------ */
/* Server-side recomputation                                           */
/* ------------------------------------------------------------------ */

function lineInput(l: LineDraft) {
  return {
    pricingMode: l.pricingMode ?? "per_unit",
    unitPrice: Math.round(l.unitPrice ?? 0),
    quantity: Number(l.quantity ?? 1),
    widthMm: l.widthMm ?? null,
    heightMm: l.heightMm ?? null,
    areaUnit: l.areaUnit ?? "sqm",
    minArea: Number(l.minArea ?? 0),
    options: l.options ?? [],
  };
}

interface TotalsSource {
  vatMode: CompanySettings["vatMode"];
  vatRate: number;
  discountType: "percent" | "fixed";
  discountPercent: number;
  discountFixed: number;
  extraCharges: ExtraCharge[];
  depositPercent: number;
  acceptedSectionId: string | null;
  amountPaid?: number;
}

export function calcInputFrom(
  sections: SectionDraft[],
  source: TotalsSource,
): DocumentInput {
  const calcSections: SectionInput[] = sections.map((s, i) => ({
    id: s.id ?? `s${i}`,
    kind: s.kind ?? "included",
    lines: s.lines.map(lineInput),
  }));
  const charges: Charge[] = (source.extraCharges ?? []).map((c) => ({
    label: c.label,
    amount: Math.round(c.amount),
  }));
  return {
    sections: calcSections,
    selectedAlternativeId: source.acceptedSectionId,
    charges,
    discount:
      source.discountType === "percent"
        ? { type: "percent", value: Number(source.discountPercent) || 0 }
        : { type: "fixed", value: Math.round(source.discountFixed) || 0 },
    vatMode: source.vatMode,
    vatRate: Number(source.vatRate) || 0,
    depositPercent: Number(source.depositPercent) || 0,
    amountPaid: source.amountPaid ?? 0,
  };
}

/** Totals for a draft, exactly as the server will persist them. */
export function computeDraftTotals(
  sections: SectionDraft[],
  source: TotalsSource,
): DocumentResult {
  return computeDocument(calcInputFrom(sections, source));
}

/* ------------------------------------------------------------------ */
/* Persist                                                             */
/* ------------------------------------------------------------------ */

function draftSource(draft: DocumentDraft, settings: Settings): TotalsSource {
  return {
    vatMode: draft.vatMode ?? settings.vatMode,
    vatRate: draft.vatRate ?? Number(settings.vatRate),
    discountType: draft.discountType ?? "percent",
    discountPercent: draft.discountPercent ?? 0,
    discountFixed: draft.discountFixed ?? 0,
    extraCharges: draft.extraCharges ?? [],
    depositPercent: draft.depositPercent ?? Number(settings.defaultDepositPercent),
    acceptedSectionId: draft.acceptedSectionId ?? null,
    amountPaid: 0,
  };
}

/**
 * Writes a brand new document. Number and share token are minted here,
 * once, so a duplicate always gets its own identity.
 */
export async function createDocument(draft: DocumentDraft): Promise<string> {
  draft = validateDocumentDraft(draft);
  if (usesDocumentMemory()) return memoryWrite(draft, await getSettings()).id;
  await readyDocumentSchema();
  const db = getDrizzle();
  const settings = await getSettings();
  const type: DocType = draft.type ?? "quote";
  const clientId = await upsertClient(draft.client);
  const number = draft.forcedNumber?.trim() || (await nextDocumentNumber(type));
  const issueDate = draft.issueDate ?? today();
  const source = draftSource(draft, settings);
  const totals = computeDraftTotals(draft.sections, source);

  const inserted = await db
    .insert(documents)
    .values({
      id: crypto.randomUUID(),
      type,
      number,
      revision: 0,
      status: draft.status ?? "draft",
      clientId,
      projectName: draft.projectName ?? null,
      projectAddress: draft.projectAddress ?? null,
      issueDate,
      dueDate:
        draft.dueDate ??
        (type === "quote" ? addDays(issueDate, Number(settings.quoteValidityDays)) : null),
      currency: draft.currency ?? settings.currency,
      vatMode: source.vatMode,
      vatRate: source.vatRate,
      discountType: source.discountType,
      discountPercent: source.discountPercent,
      discountFixed: source.discountFixed,
      extraCharges: source.extraCharges as ExtraCharge[],
      depositPercent: source.depositPercent,
      leadTime: draft.leadTime ?? settings.defaultLeadTime,
      acceptedSectionId: source.acceptedSectionId,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      chargesTotal: totals.chargesTotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      amountPaid: 0,
      notes: draft.notes ?? null,
      terms: draft.terms ?? settings.defaultQuoteTerms,
      shareToken: randomToken(),
      createdBy: "owner",
    })
    .returning({ id: documents.id });

  const id = inserted[0]!.id;
  try { await writeSections(id, draft.sections, totals); }
  catch (error) { await db.delete(documents).where(eq(documents.id,id)); throw error; }
  return id;
}

/** Replaces the header, sections and lines of an existing document. */
export async function saveDocument(id: string, draft: DocumentDraft): Promise<DocumentResult> {
  draft = validateDocumentDraft(draft);
  if (usesDocumentMemory()) return memoryWrite(draft, await getSettings(), id).totals;
  await readyDocumentSchema();
  const db = getDrizzle();
  const existing = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (existing[0] == null) throw new Error("Document not found");

  const settings = await getSettings();
  const current = existing[0];
  const source: TotalsSource = {
    ...draftSource(draft, settings),
    // VAT mode and rate are snapshotted: they follow the document, not settings.
    vatMode: current.vatMode,
    vatRate: Number(current.vatRate),
    // amount paid lives with the payments table
    amountPaid: Number(current.amountPaid),
  };
  const totals = computeDraftTotals(draft.sections, source);
  const clientId = await upsertClient(draft.client);

  const headerUpdate = db
    .update(documents)
    .set({
      clientId,
      projectName: draft.projectName ?? current.projectName,
      projectAddress: draft.projectAddress ?? current.projectAddress,
      issueDate: draft.issueDate ?? current.issueDate,
      dueDate: draft.dueDate ?? current.dueDate,
      currency: current.currency,
      discountType: source.discountType,
      discountPercent: source.discountPercent,
      discountFixed: source.discountFixed,
      extraCharges: source.extraCharges as ExtraCharge[],
      depositPercent: source.depositPercent,
      leadTime: draft.leadTime ?? current.leadTime,
      acceptedSectionId: source.acceptedSectionId,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      chargesTotal: totals.chargesTotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      notes: draft.notes ?? current.notes,
      terms: draft.terms ?? current.terms,
      status: current.status,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id)).toSQL();

  await writeSections(id, draft.sections, totals, headerUpdate);
  return totals;
}

/**
 * Deletes and rebuilds sections + lines in a single transaction, so a
 * failed save can never leave a document half-written.
 */
async function writeSections(
  documentId: string,
  sectionDrafts: SectionDraft[],
  totals: DocumentResult,
  headerUpdate?: { sql: string; params: unknown[] },
): Promise<void> {
  const raw = getRawSql();

  interface LineRow {
    metadata: LineDraft;
    id: string;
    sectionId: string;
    position: number;
    itemId: string | null;
    code: string | null;
    description: string;
    unit: string;
    pricingMode: string;
    areaUnit: string;
    widthMm: number | null;
    heightMm: number | null;
    lengthMm: number | null;
    minArea: number;
    quantity: number;
    unitPrice: number;
    options: string;
    specKey: string | null;
    lineTotal: number;
  }

  const sectionIds: string[] = [];
  const sectionParams: (string | number | null)[][] = [];
  const lineRows: LineRow[] = [];

  sectionDrafts.forEach((s, si) => {
    const sectionId = s.id ?? crypto.randomUUID();
    sectionIds.push(sectionId);
    sectionParams.push([
      sectionId,
      documentId,
      si,
      s.title ?? null,
      s.kind ?? "included",
      s.note ?? null,
    ]);

    s.lines.forEach((l, li) => {
      const result = computeLine(lineInput(l));
      lineRows.push({
        metadata: l,
        id: crypto.randomUUID(),
        sectionId,
        position: li,
        itemId: l.itemId ?? null,
        code: l.code ?? null,
        description: l.description,
        unit: l.unit ?? "set",
        pricingMode: l.pricingMode ?? "per_unit",
        areaUnit: l.areaUnit ?? "sqm",
        widthMm: l.widthMm ?? null,
        heightMm: l.heightMm ?? null,
        lengthMm: l.lengthMm ?? null,
        minArea: Number(l.minArea ?? 0),
        quantity: Number(l.quantity ?? 1),
        unitPrice: Math.round(l.unitPrice ?? 0),
        options: JSON.stringify(l.options ?? []),
        specKey: specKeyFor(l),
        lineTotal: result.lineTotal,
      });
    });
  });

  // Sections are removed first (lines cascade), then everything is rebuilt.
  const stmts: unknown[] = [
    ...(headerUpdate ? [raw.query(headerUpdate.sql, headerUpdate.params)] : []),
    raw`delete from document_sections where document_id = ${documentId}`,
  ];

  for (const p of sectionParams) {
    stmts.push(raw`
      insert into document_sections (id, document_id, position, title, kind, note)
      values (${p[0]}, ${p[1]}, ${p[2]}, ${p[3]}, ${p[4]}, ${p[5]})
    `);
  }

  for (const l of lineRows) {
    stmts.push(raw`
      insert into document_lines (
        id, document_id, section_id, position, item_id, code, description, unit,
        pricing_mode, area_unit, width_mm, height_mm, length_mm, min_area,
        quantity, unit_price, options, spec_key, line_total,
        product_id, series_id, input_unit, glass, finish, notes, design_json, design_svg
      ) values (
        ${l.id}, ${documentId}, ${l.sectionId}, ${l.position}, ${l.itemId}, ${l.code},
        ${l.description}, ${l.unit}, ${l.pricingMode}, ${l.areaUnit},
        ${l.widthMm}, ${l.heightMm}, ${l.lengthMm}, ${l.minArea},
        ${l.quantity}, ${l.unitPrice}, ${l.options}, ${l.specKey}, ${l.lineTotal},
        ${l.metadata.productId ?? null}, ${l.metadata.seriesId ?? null}, ${l.metadata.inputUnit ?? "m"},
        ${l.metadata.glass ?? null}, ${l.metadata.finish ?? null}, ${l.metadata.notes ?? null},
        ${l.metadata.designJson ? JSON.stringify(l.metadata.designJson) : null}, ${l.metadata.designSvg ?? null}
      )
    `);
  }

  stmts.push(raw`
    update documents set
      subtotal = ${totals.subtotal},
      discount_amount = ${totals.discountAmount},
      charges_total = ${totals.chargesTotal},
      vat_amount = ${totals.vatAmount},
      total = ${totals.total},
      updated_at = now()
    where id = ${documentId}
  `);

  await raw.transaction(stmts as never);
}

function specKeyFor(l: LineDraft): string | null {
  const ids = (l.options ?? []).map((o) => o.optionId);
  if (ids.length === 0 && !l.itemId) return null;
  return [l.itemId ?? "", ...ids.sort()].join("|");
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export interface DocumentGraph extends Document {
  client: Client;
  sections: (DocumentSection & { lines: DocumentLine[] })[];
}

export async function loadDocument(id: string): Promise<DocumentGraph | null> {
  if (isLocalPreview()) return previewDocuments().find((doc) => doc.id === id) ?? null;
  if (usesDocumentMemory()) { const doc=memory.docs.get(id); return doc ? structuredClone({...doc,client:memory.clients.get(doc.clientId)??doc.client}) : null; }
  await readyDocumentSchema();
  const db = getDrizzle();
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  const doc = rows[0];
  if (!doc) return null;

  const [clientRow, sectionRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, doc.clientId)).limit(1),
    db.select().from(documentSections).where(eq(documentSections.documentId, id)).orderBy(documentSections.position),
  ]);

  const sectionIds = sectionRows.map((s) => s.id);
  const lineRows = sectionIds.length
    ? await db
        .select()
        .from(documentLines)
        .where(inArray(documentLines.sectionId, sectionIds))
        .orderBy(documentLines.position)
    : [];

  return {
    ...doc,
    client: clientRow[0]!,
    sections: sectionRows.map((s) => ({
      ...s,
      lines: lineRows.filter((l) => l.sectionId === s.id),
    })),
  };
}

export async function findByShareToken(token: string): Promise<DocumentGraph | null> {
  if (isLocalPreview()) return previewDocuments().find((doc) => doc.shareToken === token) ?? null;
  if (usesDocumentMemory()) return structuredClone([...memory.docs.values()].find((doc) => doc.shareToken === token) ?? null);
  await readyDocumentSchema();
  const db = getDrizzle();
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.shareToken, token))
    .limit(1);
  return rows[0] ? loadDocument(rows[0].id) : null;
}

export interface DocumentListItem extends Document {
  clientName: string;
  paymentStatus: "unpaid" | "partial" | "paid";
}

export async function listDocuments(opts: {
  type?: DocType;
  status?: Document["status"];
  limit?: number;
} = {}): Promise<DocumentListItem[]> {
  if (isLocalPreview()) return previewDocuments()
    .filter((doc) => (!opts.type || doc.type === opts.type) && (!opts.status || doc.status === opts.status))
    .slice(0, opts.limit ?? 200)
    .map((doc) => ({ ...doc, clientName: doc.client.name, paymentStatus: "unpaid" as const }));
  if (usesDocumentMemory()) return [...memory.docs.values()].filter((doc) => (!opts.type || doc.type === opts.type) && (!opts.status || doc.status === opts.status))
    .sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, opts.limit ?? 200)
    .map((doc) => ({ ...structuredClone(doc), clientName: memory.clients.get(doc.clientId)?.name ?? doc.client.name, paymentStatus: paymentStatus(doc.total, doc.amountPaid) }));
  await readyDocumentSchema();
  const db = getDrizzle();
  const conds = [];
  if (opts.type) conds.push(eq(documents.type, opts.type));
  if (opts.status) conds.push(eq(documents.status, opts.status));

  const rows = await db
    .select({
      doc: documents,
      clientName: clients.name,
    })
    .from(documents)
    .innerJoin(clients, eq(documents.clientId, clients.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(documents.createdAt))
    .limit(opts.limit ?? 200);

  return rows.map(({ doc, clientName }) => ({
    ...doc,
    clientName,
    paymentStatus: paymentStatus(Number(doc.total), Number(doc.amountPaid)),
  }));
}

export async function listPayments(documentId: string) {
  if (isLocalPreview()) return [];
  if (usesDocumentMemory()) return structuredClone([...memory.payments.values()].filter((payment)=>payment.documentId===documentId));
  await readyDocumentSchema();
  const db = getDrizzle();
  return db
    .select()
    .from(payments)
    .where(eq(payments.documentId, documentId))
    .orderBy(desc(payments.paidAt));
}

/** True once this quote has already been turned into an invoice. */
export async function quoteAlreadyInvoiced(quoteId: string): Promise<boolean> {
  if (isLocalPreview()) return false;
  if (usesDocumentMemory()) return [...memory.docs.values()].some((doc) => doc.convertedFromId === quoteId);
  await readyDocumentSchema();
  const db = getDrizzle();
  const rows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.convertedFromId, quoteId), eq(documents.type, "invoice")))
    .limit(1);
  return rows.length > 0;
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

export async function setStatus(id: string, status: Document["status"]): Promise<void> {
  const doc = await loadDocument(id);
  if (!doc) throw new Error("Document not found");
  if (doc.type === "quote") assertQuoteTransition(doc.status, status);
  if (usesDocumentMemory()) {
    memory.docs.set(id, { ...doc, status, updatedAt: new Date(), ...(status === "sent" ? { sentAt: new Date() } : {}), ...(status === "accepted" ? { acceptedAt: new Date() } : {}) });
    return;
  }
  const db = getDrizzle();
  await db
    .update(documents)
    .set({ status, updatedAt: new Date(), ...(status === "sent" ? { sentAt: new Date() } : {}) })
    .where(eq(documents.id, id));
}

export async function markViewed(id: string): Promise<void> {
  if (usesDocumentMemory()) { const doc=memory.docs.get(id);if(doc&&!doc.viewedAt)memory.docs.set(id,{...doc,viewedAt:new Date()});return; }
  const db = getDrizzle();
  await db
    .update(documents)
    .set({ viewedAt: new Date() })
    .where(and(eq(documents.id, id), sql`${documents.viewedAt} is null`));
}

export async function acceptDocument(id: string): Promise<void> {
  const graph=await loadDocument(id);
  if(!graph || graph.type!=="quote")throw new Error("Quotation not found");
  assertQuoteTransition(graph.status,"accepted");
  if (usesDocumentMemory()) { await setStatus(id,"accepted");return; }
  const db = getDrizzle();
  await db
    .update(documents)
    .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(documents.id, id));
}

/**
 * Duplicates a document under a fresh number and share token, keeping the
 * original untouched. Sections are copied verbatim; line totals are
 * recomputed rather than copied.
 */
export async function duplicateDocument(id: string): Promise<string> {
  const graph = await loadDocument(id);
  if (!graph) throw new Error("Document not found");

  const c = graph.client;
  const sectionIds = new Map(graph.sections.map((section)=>[section.id,crypto.randomUUID()]));

  return createDocument({
    type: graph.type,
    client: {
      id: c.id,
      name: c.name,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      address: c.address,
      tin: c.tin,
      notes: c.notes,
    },
    projectName: graph.projectName,
    projectAddress: graph.projectAddress,
    issueDate: today(),
    currency: graph.currency,
    vatMode: graph.vatMode,
    vatRate: Number(graph.vatRate),
    discountType: graph.discountType as "percent" | "fixed",
    discountPercent: Number(graph.discountPercent),
    discountFixed: Number(graph.discountFixed),
    extraCharges: (graph.extraCharges ?? []) as ExtraCharge[],
    depositPercent: Number(graph.depositPercent),
    leadTime: graph.leadTime,
    notes: graph.notes,
    terms: graph.terms,
    acceptedSectionId: graph.acceptedSectionId ? sectionIds.get(graph.acceptedSectionId) ?? null : null,
    sections: graph.sections.map((s) => ({
      id: sectionIds.get(s.id),
      title: s.title,
      kind: s.kind,
      note: s.note,
      lines: s.lines.map((l) => ({
        ...l,
        itemId: l.itemId,
        code: l.code,
        description: l.description,
        unit: l.unit,
        pricingMode: l.pricingMode,
        areaUnit: l.areaUnit,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        lengthMm: l.lengthMm,
        minArea: Number(l.minArea),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        options: (l.options ?? []) as LineOptionSnapshot[],
      })),
    })),
  });
}

/**
 * Converts an accepted quote into a deposit invoice: same lines and prices
 * (snapshotted at quote time), a new invoice number, and the 70% deposit
 * shown as the amount due.
 */
export async function convertQuoteToInvoice(quoteId: string): Promise<string> {
  const graph = await loadDocument(quoteId);
  if (!graph) throw new Error("Document not found");
  if (graph.type !== "quote") throw new Error("Only quotes can be converted");

  const settings = await getSettings();
  const c = graph.client;
  const sectionIds = new Map(graph.sections.map((section)=>[section.id,crypto.randomUUID()]));

  return createDocument({
    type: "invoice",
    client: {
      id:c.id,
      name: c.name,
      contactPerson: c.contactPerson,
      email: c.email,
      phone: c.phone,
      address: c.address,
      tin: c.tin,
      notes: c.notes,
    },
    projectName: graph.projectName,
    projectAddress: graph.projectAddress,
    issueDate: today(),
    dueDate: addDays(today(), Number(settings.paymentTermsDays)),
    currency: graph.currency,
    vatMode: graph.vatMode,
    vatRate: Number(graph.vatRate),
    discountType: graph.discountType as "percent" | "fixed",
    discountPercent: Number(graph.discountPercent),
    discountFixed: Number(graph.discountFixed),
    extraCharges: (graph.extraCharges ?? []) as ExtraCharge[],
    depositPercent: Number(graph.depositPercent),
    leadTime: graph.leadTime,
    notes: graph.notes,
    terms: settings.defaultInvoiceTerms ?? graph.terms,
    status: "unpaid",
    acceptedSectionId: graph.acceptedSectionId ? sectionIds.get(graph.acceptedSectionId) ?? null : null,
    sections: graph.sections.map((s) => ({
      id: sectionIds.get(s.id),
      title: s.title,
      kind: s.kind,
      note: s.note,
      lines: s.lines.map((l) => ({
        ...l,
        itemId: l.itemId,
        code: l.code,
        description: l.description,
        unit: l.unit,
        pricingMode: l.pricingMode,
        areaUnit: l.areaUnit,
        widthMm: l.widthMm,
        heightMm: l.heightMm,
        lengthMm: l.lengthMm,
        minArea: Number(l.minArea),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        options: (l.options ?? []) as LineOptionSnapshot[],
      })),
    })),
  }).then(async (invoiceId) => {
    if(usesDocumentMemory()){
      const invoice=memory.docs.get(invoiceId)!;
      memory.docs.set(invoiceId,{...invoice,convertedFromId:quoteId,status:"unpaid"});
      memory.docs.set(quoteId,{...graph,status:"accepted"});
      return invoiceId;
    }
    await getDrizzle()
      .update(documents)
      .set({ convertedFromId: quoteId })
      .where(eq(documents.id, invoiceId));
    await getDrizzle()
      .update(documents)
      .set({ status: "accepted" })
      .where(eq(documents.id, quoteId));
    return invoiceId;
  });
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export async function recordPayment(input: {
  documentId: string;
  amount: number; // centavos
  method?: "cash" | "gcash" | "maya" | "bank_transfer" | "check" | "other";
  reference?: string | null;
  notes?: string | null;
}): Promise<void> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Payment amount must be greater than zero");
  if(usesDocumentMemory()){
    if(!memory.docs.has(input.documentId))throw new Error("Document not found");
    const id=crypto.randomUUID();memory.payments.set(id,{id,documentId:input.documentId,amount:Math.round(input.amount),method:input.method??"cash",reference:input.reference??null,notes:input.notes??null,recordedBy:"owner",paidAt:new Date()});
    await recalcAmountPaid(input.documentId);return;
  }
  const db = getDrizzle();

  await db.insert(payments).values({
    documentId: input.documentId,
    amount: Math.round(input.amount),
    method: input.method ?? "cash",
    reference: input.reference ?? null,
    notes: input.notes ?? null,
    recordedBy: "owner",
  });

  await recalcAmountPaid(input.documentId);
}

export async function deletePayment(paymentId: string): Promise<void> {
  if(usesDocumentMemory()){const payment=memory.payments.get(paymentId);if(payment){memory.payments.delete(paymentId);await recalcAmountPaid(payment.documentId);}return;}
  const db = getDrizzle();
  const rows = await db
    .select({ documentId: payments.documentId })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!rows[0]) return;
  await db.delete(payments).where(eq(payments.id, paymentId));
  await recalcAmountPaid(rows[0].documentId);
}

/** Sums the payment rows and stores the result on the document. */
export async function recalcAmountPaid(documentId: string): Promise<void> {
  if(usesDocumentMemory()){
    const doc=memory.docs.get(documentId);if(!doc)return;
    const amountPaid=[...memory.payments.values()].filter(p=>p.documentId===documentId).reduce((sum,p)=>sum+p.amount,0);
    memory.docs.set(documentId,{...doc,amountPaid,status:doc.type==="invoice"?paymentStatus(doc.total,amountPaid):doc.status,updatedAt:new Date()});return;
  }
  const db = getDrizzle();
  const sum = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.documentId, documentId));
  const amountPaid = Math.round(Number(sum[0]?.total ?? 0));

  const doc = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  const current = doc[0];
  if (!current) return;

  const status =
    current.type === "invoice"
      ? paymentStatus(Number(current.total), amountPaid)
      : current.status;

  await db
    .update(documents)
    .set({ amountPaid, status: status as Document["status"], updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}
