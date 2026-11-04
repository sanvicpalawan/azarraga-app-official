import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const currencyEnum = pgEnum("currency", ["PHP", "USD", "EUR"]);
export const docTypeEnum = pgEnum("doc_type", ["quote", "invoice"]);
export const docStatusEnum = pgEnum("doc_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "unpaid",
  "partial",
  "paid",
  "void",
]);
export const vatModeEnum = pgEnum("vat_mode", ["none", "exclusive", "inclusive"]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);
export const pricingModeEnum = pgEnum("pricing_mode", ["per_unit", "per_area"]);
export const areaUnitEnum = pgEnum("area_unit", ["sqft", "sqm"]);
// "included" sections are summed into the total.
// "alternative" sections are options (Option A / Option B): only the accepted one counts.
export const sectionKindEnum = pgEnum("section_kind", ["included", "alternative"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "gcash",
  "maya",
  "bank_transfer",
  "check",
  "other",
]);

/* ------------------------------------------------------------------ */
/* Auth note: Better Auth generates its own user/session/account      */
/* tables (`npx @better-auth/cli generate`). Add `role` ("owner" |    */
/* "staff") as an additionalField on the user. user ids are text.     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Company settings (single row, id = 1)                              */
/* ------------------------------------------------------------------ */

export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("My Company"),
  address: text("address"),
  phone: text("phone"), // e.g. "0917-894-1339; 0915-535-5233"
  email: text("email"),
  tin: text("tin"),
  logoDataUrl: text("logo_data_url"),

  // Money
  currency: currencyEnum("currency").notNull().default("PHP"),
  vatMode: vatModeEnum("vat_mode").notNull().default("none"),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2, mode: "number" })
    .notNull()
    .default(12),

  // Numbering: "{prefix}{year}-{seq}" -> Q2026-645. Sequence steps by numberStep (default 5).
  quotePrefix: text("quote_prefix").notNull().default("Q"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  numberPattern: text("number_pattern").notNull().default("{prefix}{year}-{seq}"),
  numberStep: integer("number_step").notNull().default(5),
  numberPad: integer("number_pad").notNull().default(0),

  // Defaults applied to new documents
  quoteValidityDays: integer("quote_validity_days").notNull().default(30),
  paymentTermsDays: integer("payment_terms_days").notNull().default(15),
  defaultDepositPercent: numeric("default_deposit_percent", {
    precision: 5,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(70),
  defaultLeadTime: text("default_lead_time").notNull().default("30-45 working days"),
  defaultQuoteTerms: text("default_quote_terms"),
  defaultInvoiceTerms: text("default_invoice_terms"),
  defaultNotes: text("default_notes"),
  paymentInstructions: text("payment_instructions"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Atomic document numbering                                          */
/* ------------------------------------------------------------------ */

export const numberSequences = pgTable(
  "number_sequences",
  {
    type: docTypeEnum("type").notNull(),
    year: integer("year").notNull(),
    last: integer("last").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.type, t.year] })],
);

/* ------------------------------------------------------------------ */
/* Clients                                                            */
/* ------------------------------------------------------------------ */

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    email: text("email"),
    phone: text("phone"), // mobile, used for WhatsApp / Viber links
    address: text("address"),
    tin: text("tin"),
    notes: text("notes"),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

/* ------------------------------------------------------------------ */
/* Catalog. All prices are integer minor units (centavos).            */
/* ------------------------------------------------------------------ */

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // Windows, Doors, Louvers, Railings, Shower Enclosures
  codePrefix: text("code_prefix"), // W, D, AL, SR, SE, BD -> auto item codes W1, W2, D1 ...
  sortOrder: integer("sort_order").notNull().default(0),
});

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull().default("set"),
    pricingMode: pricingModeEnum("pricing_mode").notNull().default("per_unit"),
    areaUnit: areaUnitEnum("area_unit").notNull().default("sqm"),
    // REFERENCE price only. Real prices are typed per line (see price_history).
    unitPrice: integer("unit_price").notNull().default(0),
    minArea: numeric("min_area", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("items_category_idx").on(t.categoryId)],
);

/**
 * Spec dropdown groups the admin edits. Each selected option contributes one
 * fragment to the auto-written line description, ordered by sortOrder:
 *   Series        "798 Series"
 *   Type          "2 Panel Sliding Window"   (joinWithPrevious = true -> joins with a space)
 *   Frame         "HA Frame"
 *   Glass         "6mm Annealed Ref Bronze Glass"
 * => "798 Series 2 Panel Sliding Window, HA Frame, 6mm Annealed Ref Bronze Glass, 1.50 x 2.10"
 */
export const optionGroups = pgTable("option_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }), // null = all categories
  joinWithPrevious: boolean("join_with_previous").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // the text fragment used in the description
    priceAdjustment: integer("price_adjustment").notNull().default(0), // optional flat add-on per piece
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("options_group_idx").on(t.groupId)],
);

/* ------------------------------------------------------------------ */
/* Documents (quotes + invoices share one table)                      */
/* ------------------------------------------------------------------ */

export type ExtraCharge = { label: string; amount: number }; // e.g. "Delivery and Installation"

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: docTypeEnum("type").notNull(),
    number: text("number").notNull(), // Q2026-645
    revision: integer("revision").notNull().default(0), // 0 = original, 1 = Rev 1 ...
    status: docStatusEnum("status").notNull().default("draft"),

    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    projectName: text("project_name"), // e.g. "Tara Hostel"
    projectAddress: text("project_address"), // site location line: "Lio, El Nido", "Port Barton"

    issueDate: date("issue_date").notNull().defaultNow(),
    dueDate: date("due_date"), // invoice due date, or quote valid-until

    currency: currencyEnum("currency").notNull(),
    vatMode: vatModeEnum("vat_mode").notNull().default("none"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2, mode: "number" })
      .notNull()
      .default(12),

    discountType: discountTypeEnum("discount_type").notNull().default("percent"),
    discountPercent: numeric("discount_percent", {
      precision: 5,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    discountFixed: integer("discount_fixed").notNull().default(0),

    // Charges added after discount: delivery, installation, etc.
    extraCharges: jsonb("extra_charges").$type<ExtraCharge[]>().notNull().default([]),

    depositPercent: numeric("deposit_percent", {
      precision: 5,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(70),
    leadTime: text("lead_time"), // "30-45 working days" - varies per quote

    // Which alternative section the client picked (null until chosen)
    acceptedSectionId: uuid("accepted_section_id"),

    // Cached totals (always recomputed server-side with lib/calc.ts)
    subtotal: integer("subtotal").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    chargesTotal: integer("charges_total").notNull().default(0),
    vatAmount: integer("vat_amount").notNull().default(0),
    total: integer("total").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),

    notes: text("notes"),
    terms: text("terms"),

    shareToken: text("share_token").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),

    convertedFromId: uuid("converted_from_id").references(
      (): AnyPgColumn => documents.id,
      { onDelete: "set null" },
    ),

    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_number_rev_idx").on(t.number, t.revision, t.type),
    uniqueIndex("documents_share_token_idx").on(t.shareToken),
    index("documents_client_idx").on(t.clientId),
    index("documents_type_status_idx").on(t.type, t.status),
  ],
);

/**
 * Every document has at least one section. A plain quote = one "included" section
 * with a null title. Quotes with Option A / Option B (or 3-panel vs 4-panel vs
 * 5-panel) use "alternative" sections, each showing its own total.
 */
export const documentSections = pgTable(
  "document_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    title: text("title"), // "Option A - Jalouplus 4\""
    kind: sectionKindEnum("kind").notNull().default("included"),
    note: text("note"),
  },
  (t) => [index("document_sections_doc_idx").on(t.documentId, t.position)],
);

export type LineOptionSnapshot = {
  groupId: string;
  groupName: string;
  optionId: string;
  label: string;
  priceAdjustment: number;
};

export const documentLines = pgTable(
  "document_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => documentSections.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),

    // Optional legacy catalog references; sizes remain canonical millimetres.
    productId: integer("product_id"),
    seriesId: integer("series_id"),
    inputUnit: text("input_unit").notNull().default("m"),
    glass: text("glass"),
    finish: text("finish"),
    notes: text("notes"),
    designJson: jsonb("design_json").$type<Record<string, unknown>>(),
    designSvg: text("design_svg"),

    code: text("code"), // W1, D1, AL3, SR, BD1
    description: text("description").notNull(), // auto-composed from options + size, editable
    unit: text("unit").notNull().default("set"),

    pricingMode: pricingModeEnum("pricing_mode").notNull().default("per_unit"),
    areaUnit: areaUnitEnum("area_unit").notNull().default("sqm"),
    // Sizes stored in millimetres, entered and shown in metres (3.345 m = 3345 mm)
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    lengthMm: integer("length_mm"), // for linear items (railings: 10.70 LM)
    minArea: numeric("min_area", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(0),

    quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    unitPrice: integer("unit_price").notNull().default(0), // typed by the user, per set
    options: jsonb("options").$type<LineOptionSnapshot[]>().notNull().default([]),
    specKey: text("spec_key"), // stable key of selected option ids, for price memory
    lineTotal: integer("line_total").notNull().default(0),
  },
  (t) => [
    index("document_lines_doc_idx").on(t.documentId, t.position),
    index("document_lines_section_idx").on(t.sectionId),
  ],
);

/** Sketches / top-view drawings attached to a quote (e.g. railing layout). */
export const documentAttachments = pgTable(
  "document_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    lineId: uuid("line_id").references(() => documentLines.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    dataUrl: text("data_url").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("document_attachments_doc_idx").on(t.documentId)],
);

/**
 * Price memory. Prices are not a clean per-area formula, so the editor
 * autofills the last price used for the same spec + size, and the owner
 * adjusts it. One row is written per line when a quote is sent.
 */
export const priceHistory = pgTable(
  "price_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    specKey: text("spec_key").notNull(),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    unitPrice: integer("unit_price").notNull(),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_lookup_idx").on(t.specKey, t.widthMm, t.heightMm)],
);

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    reference: text("reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    recordedBy: text("recorded_by"),
  },
  (t) => [index("payments_doc_idx").on(t.documentId)],
);

/* ------------------------------------------------------------------ */
/* Audit log                                                          */
/* ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                          */
/* ------------------------------------------------------------------ */

export const documentsRelations = relations(documents, ({ one, many }) => ({
  client: one(clients, { fields: [documents.clientId], references: [clients.id] }),
  sections: many(documentSections),
  lines: many(documentLines),
  payments: many(payments),
  attachments: many(documentAttachments),
}));

export const documentSectionsRelations = relations(documentSections, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentSections.documentId],
    references: [documents.id],
  }),
  lines: many(documentLines),
}));

export const documentLinesRelations = relations(documentLines, ({ one }) => ({
  document: one(documents, {
    fields: [documentLines.documentId],
    references: [documents.id],
  }),
  section: one(documentSections, {
    fields: [documentLines.sectionId],
    references: [documentSections.id],
  }),
  item: one(items, { fields: [documentLines.itemId], references: [items.id] }),
}));

export const documentAttachmentsRelations = relations(documentAttachments, ({ one }) => ({
  document: one(documents, {
    fields: [documentAttachments.documentId],
    references: [documents.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  document: one(documents, {
    fields: [payments.documentId],
    references: [documents.id],
  }),
}));

export const optionGroupsRelations = relations(optionGroups, ({ one, many }) => ({
  category: one(categories, {
    fields: [optionGroups.categoryId],
    references: [categories.id],
  }),
  options: many(options),
}));

export const optionsRelations = relations(options, ({ one }) => ({
  group: one(optionGroups, { fields: [options.groupId], references: [optionGroups.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  items: many(items),
  optionGroups: many(optionGroups),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  category: one(categories, { fields: [items.categoryId], references: [categories.id] }),
}));

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type CompanySettings = typeof companySettings.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type OptionGroup = typeof optionGroups.$inferSelect;
export type Option = typeof options.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentSection = typeof documentSections.$inferSelect;
export type DocumentLine = typeof documentLines.$inferSelect;
export type DocumentAttachment = typeof documentAttachments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
