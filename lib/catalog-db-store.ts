import type { Attribute, Catalog, Category, FinishedProject, FinishedProjectInput, FinishedProjectItem, Product, Settings } from "./catalog-types";
import type {
  AttributeType,
  CatalogBackend,
  MediaAsset,
  MediaInput,
  MediaUsage,
  Overview,
  ProductInput,
  ProductRecord,
  Quotation,
  QuotationInput,
  SettingsInput,
  StoredFile,
} from "./catalog-store-types";
import { getDb, readySchema, type Db } from "./db";

type Row = Record<string, unknown>;

const str = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);
const num = (value: unknown): number =>
  value === null || value === undefined ? 0 : Number(value);
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : str(value);
const nullableNum = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);
const nullableStr = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

function mapCategory(row: Row): Category {
  return { id: num(row.id), name: str(row.name), sortOrder: num(row.sort_order) };
}

function mapAttribute(row: Row): Attribute {
  return {
    id: num(row.id),
    type: str(row.type) as AttributeType,
    name: str(row.name),
    sortOrder: num(row.sort_order),
  };
}

function mapSettings(row: Row): Settings {
  return {
    id: num(row.id),
    companyName: str(row.company_name),
    logoKey: nullableStr(row.logo_key),
    address: str(row.address),
    contactNumbers: str(row.contact_numbers),
    email: str(row.email),
    tin: str(row.tin),
    bankAccountName: str(row.bank_account_name),
    bankAccountNumber: str(row.bank_account_number),
    bankName: str(row.bank_name),
    bankBranch: str(row.bank_branch),
    termsConditions: str(row.terms_conditions),
    pdfHeader: str(row.pdf_header),
    updatedAt: iso(row.updated_at),
  };
}

const PRODUCT_SELECT = `
  select p.id, p.name, p.category_id, c.name as category_name, p.base_price,
         p.description, p.default_series_id, p.default_glass_id,
         s.name as default_series, g.name as default_glass,
         p.image_key, p.image_path, p.product_key, p.design_id, p.is_custom,
         p.updated_at
  from products p
  join categories c on c.id = p.category_id
  left join attributes s on s.id = p.default_series_id
  left join attributes g on g.id = p.default_glass_id`;

function mapProductView(row: Row): Product {
  const id = num(row.id);
  const imageKey = nullableStr(row.image_key);
  const imagePath = nullableStr(row.image_path);
  return {
    id,
    name: str(row.name),
    categoryId: num(row.category_id),
    categoryName: str(row.category_name),
    basePrice: num(row.base_price),
    description: str(row.description),
    defaultSeriesId: nullableNum(row.default_series_id),
    defaultGlassId: nullableNum(row.default_glass_id),
    defaultSeries: nullableStr(row.default_series),
    defaultGlass: nullableStr(row.default_glass),
    imageKey,
    imagePath,
    imageUrl: imageKey ? `/api/products/${id}/image` : imagePath,
    productKey: nullableStr(row.product_key),
    designId: nullableStr(row.design_id),
    isCustom: Boolean(row.is_custom),
    updatedAt: iso(row.updated_at),
  };
}

async function selectProductView(
  db: Db,
  id: number,
): Promise<Product | undefined> {
  const rows = await db`${db.unsafe(PRODUCT_SELECT)} where p.id = ${id}`;
  return rows[0] ? mapProductView(rows[0] as Row) : undefined;
}

function toRecord(product: Product): ProductRecord {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    basePrice: product.basePrice,
    description: product.description,
    defaultSeriesId: product.defaultSeriesId,
    defaultGlassId: product.defaultGlassId,
    defaultSeries: product.defaultSeries,
    defaultGlass: product.defaultGlass,
    imageKey: product.imageKey,
    imagePath: product.imagePath,
    productKey: product.productKey,
    designId: product.designId,
    isCustom: product.isCustom,
    updatedAt: product.updatedAt,
  };
}

/**
 * The image library row. `used_by` arrives as a JSON aggregate of the products
 * whose image points at this key (the Neon driver returns json as a JS value,
 * but a string is handled too for safety).
 */
function mapMedia(row: Row): MediaAsset {
  const raw = row.used_by;
  let usedBy: MediaUsage[] = [];
  if (Array.isArray(raw)) {
    usedBy = raw as MediaUsage[];
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as MediaUsage[];
      if (Array.isArray(parsed)) usedBy = parsed;
    } catch {
      usedBy = [];
    }
  }
  const id = num(row.id);
  return {
    id,
    key: str(row.key),
    filename: str(row.filename),
    contentType: str(row.content_type),
    sizeBytes: num(row.size_bytes),
    createdAt: iso(row.created_at),
    url: `/api/media/${id}`,
    usedBy: usedBy.map((item) => ({ id: num(item.id), name: str(item.name) })),
  };
}

const MEDIA_SELECT = `
  select m.id, m.key, m.filename, m.content_type, m.size_bytes, m.created_at,
         coalesce(
           (select json_agg(json_build_object('id', p.id, 'name', p.name) order by p.name)
            from products p where p.image_key = m.key),
           '[]'::json
         ) as used_by
  from media m`;

function extensionForContentType(contentType: string): string {
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg") return "jpg";
  return "png";
}

function mapQuotation(row: Row): Quotation {
  const item = (
    typeof row.item === "object" && row.item !== null
      ? row.item
      : {}
  ) as Quotation["item"];
  return {
    quotationNumber: str(row.quotation_number),
    customerName: str(row.customer_name),
    projectName: str(row.project_name),
    projectAddress: str(row.project_address),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    grandTotal: num(row.grand_total),
    totalSqft: num(row.total_sqft),
    item,
    id: num(row.id),
    status: "draft",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapProject(row: Row): FinishedProject {
  const items = (Array.isArray(row.items) ? row.items : []) as FinishedProjectItem[];
  return {
    id: num(row.id),
    projectName: str(row.project_name),
    clientName: str(row.client_name),
    projectAddress: str(row.project_address),
    invoiceNumber: str(row.invoice_number),
    invoiceDate: str(row.invoice_date),
    totalAmount: num(row.total_amount),
    fileName: str(row.file_name),
    fileType: str(row.file_type),
    fileSize: num(row.file_size),
    fileData: str(row.file_data),
    items,
    notes: str(row.notes),
    status: (str(row.status) as FinishedProject["status"]) || "completed",
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

async function getSettingsDirect(db: Db): Promise<Settings> {
  const [row] = await db`select * from settings where id = 1`;
  if (!row) {
    throw new Error("Settings row is missing from the catalog database.");
  }
  return mapSettings(row as Row);
}

let backendInstance: CatalogBackend | null = null;

export function getDbBackend(): CatalogBackend {
  backendInstance ??= createDbBackend();
  return backendInstance;
}

function createDbBackend(): CatalogBackend {
  return {
    async getCatalogSnapshot(): Promise<Catalog> {
      await readySchema();
      const db = getDb();
      const settings = await getSettingsDirect(db);
      const categoryRows = await db`
        select id, name, sort_order from categories order by sort_order, id`;
      const attributeRows = await db`
        select id, type, name, sort_order from attributes
        order by (case type
          when 'series' then 0
          when 'glass' then 1
          when 'color' then 2
          when 'lock' then 3
          else 4
        end), sort_order, id`;
      const productRows = await db`${db.unsafe(PRODUCT_SELECT)} order by p.id`;
      return {
        settings,
        categories: categoryRows.map((row: Row) => mapCategory(row)),
        products: productRows.map((row: Row) => mapProductView(row)),
        attributes: attributeRows.map((row: Row) => mapAttribute(row)),
      };
    },

    async getProduct(id: number): Promise<Product | undefined> {
      await readySchema();
      return selectProductView(getDb(), id);
    },

    async getProductRecord(id: number): Promise<ProductRecord | undefined> {
      const product = await this.getProduct(id);
      return product ? toRecord(product) : undefined;
    },

    async getSettings(): Promise<Settings> {
      await readySchema();
      return getSettingsDirect(getDb());
    },

    async updateSettings(input: SettingsInput): Promise<Settings> {
      await readySchema();
      const db = getDb();
      await db`
        update settings set
          company_name = ${input.companyName},
          address = ${input.address},
          contact_numbers = ${input.contactNumbers},
          email = ${input.email},
          tin = ${input.tin},
          bank_account_name = ${input.bankAccountName},
          bank_account_number = ${input.bankAccountNumber},
          bank_name = ${input.bankName},
          bank_branch = ${input.bankBranch},
          terms_conditions = ${input.termsConditions},
          pdf_header = ${input.pdfHeader},
          updated_at = now()
        where id = 1`;
      return getSettingsDirect(db);
    },

    async addProduct(input: ProductInput): Promise<Product> {
      await readySchema();
      const db = getDb();
      const [category] = await db`select id from categories where id = ${input.categoryId}`;
      if (!category) throw new Error("Category not found");
      const [duplicate] = await db`
        select id from products
        where category_id = ${input.categoryId} and name = ${input.name}`;
      if (duplicate) throw new Error("Product already exists");
      const [inserted] = await db`
        insert into products (
          name, category_id, base_price, description,
          default_series_id, default_glass_id, product_key, design_id, is_custom
        ) values (
          ${input.name}, ${input.categoryId}, ${input.basePrice}, ${input.description},
          ${input.defaultSeriesId}, ${input.defaultGlassId}, ${input.productKey ?? null},
          ${input.designId ?? null}, ${input.isCustom ?? false}
        )
        returning id`;
      const product = await selectProductView(db, num((inserted as Row).id));
      if (!product) throw new Error("Product was not created.");
      return product;
    },

    async updateProduct(id: number, input: ProductInput): Promise<Product> {
      await readySchema();
      const db = getDb();
      const [existing] = await db`select id from products where id = ${id}`;
      if (!existing) throw new Error("Product not found");
      const [category] = await db`select id from categories where id = ${input.categoryId}`;
      if (!category) throw new Error("Category not found");
      const [duplicate] = await db`
        select id from products
        where category_id = ${input.categoryId} and name = ${input.name} and id <> ${id}`;
      if (duplicate) throw new Error("Product already exists");
      await db`
        update products set
          name = ${input.name},
          category_id = ${input.categoryId},
          base_price = ${input.basePrice},
          description = ${input.description},
          default_series_id = ${input.defaultSeriesId},
          default_glass_id = ${input.defaultGlassId},
          product_key = coalesce(${input.productKey ?? null}, product_key),
          design_id = coalesce(${input.designId ?? null}, design_id),
          is_custom = coalesce(${input.isCustom ?? null}, is_custom),
          updated_at = now()
        where id = ${id}`;
      const product = await selectProductView(db, id);
      if (!product) throw new Error("Product could not be loaded.");
      return product;
    },

    async deleteProduct(id: number): Promise<ProductRecord | undefined> {
      await readySchema();
      const db = getDb();
      const product = await selectProductView(db, id);
      if (!product) return undefined;
      await db`delete from products where id = ${id}`;
      // Its image belongs to the shared library and is kept for reuse.
      return toRecord(product);
    },

    async addCategory(name: string): Promise<Category> {
      await readySchema();
      const db = getDb();
      const [duplicate] = await db`select id from categories where name = ${name}`;
      if (duplicate) throw new Error("Category already exists");
      const [next] = await db`select coalesce(max(sort_order), -1) + 1 as next from categories`;
      const [row] = await db`
        insert into categories (name, sort_order) values (${name}, ${num(next.next)})
        returning id, name, sort_order`;
      return mapCategory(row as Row);
    },

    async updateCategory(id: number, name: string): Promise<Category> {
      await readySchema();
      const db = getDb();
      const [existing] = await db`select id from categories where id = ${id}`;
      if (!existing) throw new Error("Category not found");
      const [duplicate] = await db`
        select id from categories where name = ${name} and id <> ${id}`;
      if (duplicate) throw new Error("Category already exists");
      const [row] = await db`
        update categories set name = ${name} where id = ${id}
        returning id, name, sort_order`;
      return mapCategory(row as Row);
    },

    async deleteCategory(id: number): Promise<boolean> {
      await readySchema();
      const db = getDb();
      const [inUse] = await db`
        select count(*) as count from products where category_id = ${id}`;
      if (num(inUse.count) > 0) throw new Error("Category is in use");
      const [row] = await db`delete from categories where id = ${id} returning id`;
      return Boolean(row);
    },

    async addAttribute(type: AttributeType, name: string): Promise<Attribute> {
      await readySchema();
      const db = getDb();
      const [duplicate] = await db`
        select id from attributes where type = ${type} and name = ${name}`;
      if (duplicate) throw new Error("Attribute already exists");
      const [next] = await db`
        select coalesce(max(sort_order), -1) + 1 as next
        from attributes where type = ${type}`;
      const [row] = await db`
        insert into attributes (type, name, sort_order)
        values (${type}, ${name}, ${num(next.next)})
        returning id, type, name, sort_order`;
      return mapAttribute(row as Row);
    },

    async updateAttribute(id: number, name: string): Promise<Attribute> {
      await readySchema();
      const db = getDb();
      const [existing] = await db`select type from attributes where id = ${id}`;
      if (!existing) throw new Error("Attribute not found");
      const [duplicate] = await db`
        select id from attributes
        where type = ${existing.type} and name = ${name} and id <> ${id}`;
      if (duplicate) throw new Error("Attribute already exists");
      const [row] = await db`
        update attributes set name = ${name} where id = ${id}
        returning id, type, name, sort_order`;
      return mapAttribute(row as Row);
    },

    async deleteAttribute(id: number): Promise<boolean> {
      await readySchema();
      const db = getDb();
      const [inUse] = await db`
        select count(*) as count from products
        where default_series_id = ${id} or default_glass_id = ${id}`;
      if (num(inUse.count) > 0) throw new Error("Attribute is in use");
      const [row] = await db`delete from attributes where id = ${id} returning id`;
      return Boolean(row);
    },

    /**
     * Product photos and the company logo are stored inside Neon Postgres as
     * base64 text, so image uploads need no second provider and no extra
     * environment variables — the database connection is enough.
     */
    async saveFile(
      prefix: string,
      extension: string,
      body: ArrayBuffer,
      contentType: string,
    ): Promise<string> {
      await readySchema();
      const db = getDb();
      const key = `${prefix}/${crypto.randomUUID()}.${extension}`;
      await db`
        insert into files (key, content_type, size_bytes, data)
        values (${key}, ${contentType}, ${body.byteLength}, ${Buffer.from(body).toString("base64")})`;
      return key;
    },

    async getFile(key: string): Promise<StoredFile | undefined> {
      await readySchema();
      const [row] = await getDb()`
        select content_type, data from files where key = ${key}`;
      if (!row) return undefined;
      const buffer = Buffer.from(str((row as Row).data), "base64");
      const body = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
      return {
        body,
        contentType: str((row as Row).content_type) || "application/octet-stream",
        etag: `"${key.replace(/[^a-z0-9]/gi, "")}"`,
      };
    },

    async removeFile(key: string | null | undefined): Promise<void> {
      if (!key) return;
      await readySchema();
      await getDb()`delete from files where key = ${key}`;
    },

    async listMedia(): Promise<MediaAsset[]> {
      await readySchema();
      const db = getDb();
      const rows = await db`${db.unsafe(MEDIA_SELECT)}
        order by m.created_at desc, m.id desc`;
      return rows.map((row: Row) => mapMedia(row));
    },

    async getMedia(id: number): Promise<MediaAsset | undefined> {
      await readySchema();
      const db = getDb();
      const rows = await db`${db.unsafe(MEDIA_SELECT)} where m.id = ${id}`;
      const row = rows[0] as Row | undefined;
      return row ? mapMedia(row) : undefined;
    },

    async addMedia(input: MediaInput): Promise<MediaAsset> {
      await readySchema();
      const db = getDb();
      const key = await this.saveFile(
        "library",
        extensionForContentType(input.contentType),
        input.body,
        input.contentType,
      );
      const [row] = await db`
        insert into media (key, filename, content_type, size_bytes)
        values (${key}, ${input.filename}, ${input.contentType}, ${input.sizeBytes})
        returning id, key, filename, content_type, size_bytes, created_at`;
      return mapMedia(row as Row);
    },

    async deleteMedia(id: number): Promise<boolean> {
      await readySchema();
      const db = getDb();
      const [row] = await db`select key from media where id = ${id}`;
      if (!row) return false;
      const key = str((row as Row).key);
      const [inUse] = await db`
        select count(*) as count from products where image_key = ${key}`;
      if (num((inUse as Row).count) > 0) {
        throw new Error("Image is in use");
      }
      await db`delete from media where id = ${id}`;
      await db`delete from files where key = ${key}`;
      return true;
    },

    async attachMediaToProduct(
      productId: number,
      mediaId: number,
    ): Promise<Product | undefined> {
      await readySchema();
      const db = getDb();
      const [media] = await db`select key from media where id = ${mediaId}`;
      if (!media) throw new Error("Image not found");
      const product = await selectProductView(db, productId);
      if (!product) return undefined;
      // The object stays in the library, so it is never deleted here.
      await db`
        update products
        set image_key = ${str((media as Row).key)}, image_path = null, updated_at = now()
        where id = ${productId}`;
      return selectProductView(db, productId);
    },

    async detachProductImage(id: number): Promise<void> {
      await readySchema();
      await getDb()`
        update products
        set image_key = null, image_path = null, updated_at = now()
        where id = ${id}`;
    },

    async replaceLogo(key: string): Promise<Settings> {
      await readySchema();
      const db = getDb();
      const settings = await getSettingsDirect(db);
      await db`update settings set logo_key = ${key}, updated_at = now() where id = 1`;
      const previousKey = settings.logoKey;
      if (previousKey && previousKey !== key) {
        await db`delete from files where key = ${previousKey}`;
      }
      return getSettingsDirect(db);
    },

    async saveQuotation(input: QuotationInput): Promise<Quotation> {
      await readySchema();
      const db = getDb();
      const [row] = await db`
        insert into quotations (
          quotation_number, customer_name, project_name, project_address,
          subtotal, discount, grand_total, total_sqft, item, status, updated_at
        ) values (
          ${input.quotationNumber}, ${input.customerName}, ${input.projectName},
          ${input.projectAddress}, ${input.subtotal}, ${input.discount},
          ${input.grandTotal}, ${input.totalSqft}, ${JSON.stringify(input.item)},
          'draft', now()
        )
        on conflict (quotation_number) do update set
          customer_name = excluded.customer_name,
          project_name = excluded.project_name,
          project_address = excluded.project_address,
          subtotal = excluded.subtotal,
          discount = excluded.discount,
          grand_total = excluded.grand_total,
          total_sqft = excluded.total_sqft,
          item = excluded.item,
          updated_at = now()
        returning *`;
      return mapQuotation(row as Row);
    },

    async listQuotations(): Promise<Quotation[]> {
      await readySchema();
      const rows = await getDb()`
        select * from quotations
        order by updated_at desc, id desc
        limit 25`;
      return rows.map((row: Row) => mapQuotation(row));
    },

    async getOverview(): Promise<Overview> {
      await readySchema();
      const [row] = await getDb()`
        select (select count(*) from quotations)::int as total_quotes,
               coalesce((select sum(grand_total) from quotations), 0)::float8 as total_revenue,
               coalesce((select sum(total_sqft) from quotations), 0)::float8 as total_sqft,
               (select count(*) from products)::int as total_products,
               (select count(*) from categories)::int as total_categories,
               (select count(*) from media)::int as total_media`;
      const values = row as Row;
        return {
        totalQuotes: num(values.total_quotes),
        totalRevenue: num(values.total_revenue),
        totalSqft: num(values.total_sqft),
        totalProducts: num(values.total_products),
        totalCategories: num(values.total_categories),
        totalMedia: num(values.total_media),
      };
    },

    async listProjects(): Promise<FinishedProject[]> {
      await readySchema();
      const rows = await getDb()`
        select * from finished_projects
        order by updated_at desc, id desc`;
      return rows.map((row: Row) => mapProject(row));
    },

    async getProject(id: number): Promise<FinishedProject | undefined> {
      await readySchema();
      const [row] = await getDb()`select * from finished_projects where id = ${id}`;
      return row ? mapProject(row as Row) : undefined;
    },

    async saveProject(input: FinishedProjectInput): Promise<FinishedProject> {
      await readySchema();
      const db = getDb();
      if (input.id) {
        const [row] = await db`
          update finished_projects set
            project_name = ${input.projectName},
            client_name = ${input.clientName},
            project_address = ${input.projectAddress},
            invoice_number = ${input.invoiceNumber},
            invoice_date = ${input.invoiceDate},
            total_amount = ${input.totalAmount},
            file_name = ${input.fileName},
            file_type = ${input.fileType},
            file_size = ${input.fileSize},
            file_data = ${input.fileData ?? ""},
            items = ${JSON.stringify(input.items)}::jsonb,
            notes = ${input.notes ?? ""},
            status = ${input.status},
            updated_at = now()
          where id = ${input.id}
          returning *`;
        return mapProject(row as Row);
      }
      const [row] = await db`
        insert into finished_projects (
          project_name, client_name, project_address, invoice_number, invoice_date,
          total_amount, file_name, file_type, file_size, file_data, items, notes, status
        ) values (
          ${input.projectName}, ${input.clientName}, ${input.projectAddress},
          ${input.invoiceNumber}, ${input.invoiceDate}, ${input.totalAmount},
          ${input.fileName}, ${input.fileType}, ${input.fileSize},
          ${input.fileData ?? ""}, ${JSON.stringify(input.items)}::jsonb,
          ${input.notes ?? ""}, ${input.status}
        )
        returning *`;
      return mapProject(row as Row);
    },

    async deleteProject(id: number): Promise<boolean> {
      await readySchema();
      const rows = await getDb()`delete from finished_projects where id = ${id} returning id`;
      return rows.length > 0;
    },
  };
}
