DO $$ BEGIN
	CREATE TYPE "public"."area_unit" AS ENUM('sqft', 'sqm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."currency" AS ENUM('PHP', 'USD', 'EUR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."doc_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired', 'unpaid', 'partial', 'paid', 'void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."doc_type" AS ENUM('quote', 'invoice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."payment_method" AS ENUM('cash', 'gcash', 'maya', 'bank_transfer', 'check', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."pricing_mode" AS ENUM('per_unit', 'per_area');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."section_kind" AS ENUM('included', 'alternative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."vat_mode" AS ENUM('none', 'exclusive', 'inclusive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "audit_log" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"user_id" text,
		"action" text NOT NULL,
		"entity" text NOT NULL,
		"entity_id" text,
		"diff" jsonb,
		"created_at" timestamp with time zone DEFAULT now() NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public.categories') IS NULL THEN
		CREATE TABLE "categories" (
			"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
			"name" text NOT NULL,
			"code_prefix" text,
			"sort_order" integer DEFAULT 0 NOT NULL
		);
	END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "code_prefix" text;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "clients" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"name" text NOT NULL,
		"contact_person" text,
		"email" text,
		"phone" text,
		"address" text,
		"tin" text,
		"notes" text,
		"archived" boolean DEFAULT false NOT NULL,
		"created_at" timestamp with time zone DEFAULT now() NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "company_settings" (
		"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
		"name" text DEFAULT 'My Company' NOT NULL,
		"address" text,
		"phone" text,
		"email" text,
		"tin" text,
		"logo_data_url" text,
		"currency" "currency" DEFAULT 'PHP' NOT NULL,
		"vat_mode" "vat_mode" DEFAULT 'none' NOT NULL,
		"vat_rate" numeric(5, 2) DEFAULT 12 NOT NULL,
		"quote_prefix" text DEFAULT 'Q' NOT NULL,
		"invoice_prefix" text DEFAULT 'INV' NOT NULL,
		"number_pattern" text DEFAULT '{prefix}{year}-{seq}' NOT NULL,
		"number_step" integer DEFAULT 5 NOT NULL,
		"number_pad" integer DEFAULT 0 NOT NULL,
		"quote_validity_days" integer DEFAULT 30 NOT NULL,
		"payment_terms_days" integer DEFAULT 15 NOT NULL,
		"default_deposit_percent" numeric(5, 2) DEFAULT 70 NOT NULL,
		"default_lead_time" text DEFAULT '30-45 working days' NOT NULL,
		"default_quote_terms" text,
		"default_invoice_terms" text,
		"default_notes" text,
		"payment_instructions" text,
		"updated_at" timestamp with time zone DEFAULT now() NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "document_attachments" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"document_id" uuid NOT NULL,
		"line_id" uuid,
		"filename" text NOT NULL,
		"mime" text NOT NULL,
		"data_url" text NOT NULL,
		"caption" text,
		"position" integer DEFAULT 0 NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "document_lines" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"document_id" uuid NOT NULL,
		"section_id" uuid NOT NULL,
		"position" integer DEFAULT 0 NOT NULL,
		"item_id" uuid,
		"code" text,
		"description" text NOT NULL,
		"unit" text DEFAULT 'set' NOT NULL,
		"pricing_mode" "pricing_mode" DEFAULT 'per_unit' NOT NULL,
		"area_unit" "area_unit" DEFAULT 'sqm' NOT NULL,
		"width_mm" integer,
		"height_mm" integer,
		"length_mm" integer,
		"min_area" numeric(10, 2) DEFAULT 0 NOT NULL,
		"quantity" numeric(10, 2) DEFAULT 1 NOT NULL,
		"unit_price" integer DEFAULT 0 NOT NULL,
		"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
		"spec_key" text,
		"line_total" integer DEFAULT 0 NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "document_sections" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"document_id" uuid NOT NULL,
		"position" integer DEFAULT 0 NOT NULL,
		"title" text,
		"kind" "section_kind" DEFAULT 'included' NOT NULL,
		"note" text
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "documents" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"type" "doc_type" NOT NULL,
		"number" text NOT NULL,
		"revision" integer DEFAULT 0 NOT NULL,
		"status" "doc_status" DEFAULT 'draft' NOT NULL,
		"client_id" uuid NOT NULL,
		"project_name" text,
		"project_address" text,
		"issue_date" date DEFAULT now() NOT NULL,
		"due_date" date,
		"currency" "currency" NOT NULL,
		"vat_mode" "vat_mode" DEFAULT 'none' NOT NULL,
		"vat_rate" numeric(5, 2) DEFAULT 12 NOT NULL,
		"discount_type" "discount_type" DEFAULT 'percent' NOT NULL,
		"discount_percent" numeric(5, 2) DEFAULT 0 NOT NULL,
		"discount_fixed" integer DEFAULT 0 NOT NULL,
		"extra_charges" jsonb DEFAULT '[]'::jsonb NOT NULL,
		"deposit_percent" numeric(5, 2) DEFAULT 70 NOT NULL,
		"lead_time" text,
		"accepted_section_id" uuid,
		"subtotal" integer DEFAULT 0 NOT NULL,
		"discount_amount" integer DEFAULT 0 NOT NULL,
		"charges_total" integer DEFAULT 0 NOT NULL,
		"vat_amount" integer DEFAULT 0 NOT NULL,
		"total" integer DEFAULT 0 NOT NULL,
		"amount_paid" integer DEFAULT 0 NOT NULL,
		"notes" text,
		"terms" text,
		"share_token" text NOT NULL,
		"sent_at" timestamp with time zone,
		"viewed_at" timestamp with time zone,
		"accepted_at" timestamp with time zone,
		"converted_from_id" uuid,
		"created_by" text,
		"created_at" timestamp with time zone DEFAULT now() NOT NULL,
		"updated_at" timestamp with time zone DEFAULT now() NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "items" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"category_id" uuid,
		"name" text NOT NULL,
		"description" text,
		"unit" text DEFAULT 'set' NOT NULL,
		"pricing_mode" "pricing_mode" DEFAULT 'per_unit' NOT NULL,
		"area_unit" "area_unit" DEFAULT 'sqm' NOT NULL,
		"unit_price" integer DEFAULT 0 NOT NULL,
		"min_area" numeric(10, 2) DEFAULT 0 NOT NULL,
		"active" boolean DEFAULT true NOT NULL,
		"created_at" timestamp with time zone DEFAULT now() NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "number_sequences" (
		"type" "doc_type" NOT NULL,
		"year" integer NOT NULL,
		"last" integer DEFAULT 0 NOT NULL,
		CONSTRAINT "number_sequences_type_year_pk" PRIMARY KEY("type","year")
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "option_groups" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"name" text NOT NULL,
		"category_id" uuid,
		"join_with_previous" boolean DEFAULT false NOT NULL,
		"sort_order" integer DEFAULT 0 NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "options" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"group_id" uuid NOT NULL,
		"label" text NOT NULL,
		"price_adjustment" integer DEFAULT 0 NOT NULL,
		"active" boolean DEFAULT true NOT NULL,
		"sort_order" integer DEFAULT 0 NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "payments" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"document_id" uuid NOT NULL,
		"amount" integer NOT NULL,
		"method" "payment_method" DEFAULT 'cash' NOT NULL,
		"reference" text,
		"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
		"notes" text,
		"recorded_by" text
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TABLE "price_history" (
		"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		"spec_key" text NOT NULL,
		"width_mm" integer,
		"height_mm" integer,
		"unit_price" integer NOT NULL,
		"document_id" uuid,
		"created_at" timestamp with time zone DEFAULT now() NOT NULL
	);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "document_attachments" ADD CONSTRAINT "document_attachments_line_id_document_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."document_lines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_section_id_document_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."document_sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "document_sections" ADD CONSTRAINT "document_sections_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "documents" ADD CONSTRAINT "documents_converted_from_id_documents_id_fk" FOREIGN KEY ("converted_from_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
-- The legacy `categories` table has an integer PK (referenced by 29 products),
-- so these two foreign keys are only valid when Drizzle created a fresh
-- uuid-keyed `categories`. On the live database `items.category_id` and
-- `option_groups.category_id` stay NULL, which schema.ts documents as
-- "all categories". No data is dropped or altered either way.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'categories'
		  AND column_name = 'id' AND data_type = 'uuid'
	) THEN
		ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
		ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "options" ADD CONSTRAINT "options_group_id_option_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."option_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payments" ADD CONSTRAINT "payments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "price_history" ADD CONSTRAINT "price_history_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "document_attachments_doc_idx" ON "document_attachments" USING btree ("document_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "document_lines_doc_idx" ON "document_lines" USING btree ("document_id","position");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "document_lines_section_idx" ON "document_lines" USING btree ("section_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "document_sections_doc_idx" ON "document_sections" USING btree ("document_id","position");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE UNIQUE INDEX "documents_number_rev_idx" ON "documents" USING btree ("number","revision","type");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE UNIQUE INDEX "documents_share_token_idx" ON "documents" USING btree ("share_token");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "documents_client_idx" ON "documents" USING btree ("client_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "documents_type_status_idx" ON "documents" USING btree ("type","status");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "items_category_idx" ON "items" USING btree ("category_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "options_group_idx" ON "options" USING btree ("group_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "payments_doc_idx" ON "payments" USING btree ("document_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE INDEX "price_history_lookup_idx" ON "price_history" USING btree ("spec_key","width_mm","height_mm");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
