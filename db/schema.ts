import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const globalSettings = sqliteTable("global_settings", {
  id: integer("id").primaryKey(),
  companyName: text("company_name").notNull(),
  logoKey: text("logo_key"),
  address: text("address").notNull().default(""),
  contactNumbers: text("contact_numbers").notNull().default(""),
  email: text("email").notNull().default(""),
  tin: text("tin").notNull().default(""),
  bankAccountName: text("bank_account_name").notNull().default(""),
  bankAccountNumber: text("bank_account_number").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  bankBranch: text("bank_branch").notNull().default(""),
  termsConditions: text("terms_conditions").notNull().default(""),
  pdfHeader: text("pdf_header").notNull().default("QUOTATION"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productCategories = sqliteTable("product_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_product_categories_name").on(table.name)]);

export const productAttributes = sqliteTable("product_attributes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_product_attributes_type_name").on(table.type, table.name),
  index("idx_product_attributes_type").on(table.type),
]);

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").notNull().references(() => productCategories.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  basePrice: real("base_price").notNull().default(0),
  imageKey: text("image_key"),
  imagePath: text("image_path"),
  description: text("description").notNull().default(""),
  defaultSeriesId: integer("default_series_id").references(() => productAttributes.id, { onDelete: "set null" }),
  defaultGlassId: integer("default_glass_id").references(() => productAttributes.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_products_name_category").on(table.name, table.categoryId),
  index("idx_products_category_id").on(table.categoryId),
]);

export const quotations = sqliteTable("quotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quotationNumber: text("quotation_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  projectName: text("project_name").notNull(),
  projectAddress: text("project_address").notNull().default(""),
  status: text("status").notNull().default("draft"),
  subtotal: real("subtotal").notNull().default(0),
  discount: real("discount").notNull().default(0),
  grandTotal: real("grand_total").notNull().default(0),
  totalSqft: real("total_sqft").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_quotations_status_updated").on(table.status, table.updatedAt)]);

export const quotationItems = sqliteTable("quotation_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quotationId: integer("quotation_id").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  quantity: integer("quantity").notNull(),
  sqft: real("sqft").notNull(),
  rate: real("rate").notNull(),
  pricingMethod: text("pricing_method").notNull(),
  sectionCompany: text("section_company").notNull().default("Analok"),
  sectionType: text("section_type").notNull(),
  glass: text("glass").notNull(),
  color: text("color").notNull(),
  lock: text("lock").notNull(),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  total: real("total").notNull(),
});
