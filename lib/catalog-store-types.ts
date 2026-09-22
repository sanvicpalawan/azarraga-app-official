import type { Attribute, Catalog, Category, Product, Settings } from "./catalog-types";

export type AttributeType = Attribute["type"];

export type ProductInput = {
  name: string;
  categoryId: number;
  basePrice: number;
  description: string;
  defaultSeriesId: number | null;
  defaultGlassId: number | null;
  productKey?: string | null;
  designId?: string | null;
  isCustom?: boolean;
};

export type SettingsInput = Omit<Settings, "id" | "logoKey" | "updatedAt">;

export type QuotationItem = {
  productName: string;
  width: number;
  height: number;
  quantity: number;
  sqft: number;
  rate: number;
  pricingMethod: "sqft" | "unit";
  sectionCompany: string;
  sectionType: string;
  glass: string;
  color: string;
  lock: string;
  location: string;
  description: string;
  total: number;
};

export type QuotationInput = {
  quotationNumber: string;
  customerName: string;
  projectName: string;
  projectAddress: string;
  subtotal: number;
  discount: number;
  grandTotal: number;
  totalSqft: number;
  item: QuotationItem;
};

export type Quotation = QuotationInput & {
  id: number;
  status: "draft";
  createdAt: string;
  updatedAt: string;
};

export type StoredFile = {
  body: ArrayBuffer;
  contentType: string;
  etag: string;
};

/** A product (or any future record) that currently uses a library image. */
export type MediaUsage = { id: number; name: string };

/**
 * An image in the shared image library. Every product photo lives here too, so
 * an image uploaded for one product can be reused for another later.
 */
export type MediaAsset = {
  id: number;
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
  usedBy: MediaUsage[];
};

export type MediaInput = {
  filename: string;
  contentType: string;
  sizeBytes: number;
  body: ArrayBuffer;
};

export type ProductRecord = Omit<Product, "imageUrl">;

export type Overview = {
  totalQuotes: number;
  totalRevenue: number;
  totalSqft: number;
  totalProducts: number;
  totalCategories: number;
  totalMedia: number;
};

/**
 * The catalog data layer. Two implementations exist: a Neon Postgres +
 * S3-compatible object storage backend (used when DATABASE_URL is set) and an
 * in-memory backend for local development without a backend.
 */
export type CatalogBackend = {
  getCatalogSnapshot(): Promise<Catalog>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductRecord(id: number): Promise<ProductRecord | undefined>;
  getSettings(): Promise<Settings>;
  updateSettings(input: SettingsInput): Promise<Settings>;
  addProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: number, input: ProductInput): Promise<Product>;
  deleteProduct(id: number): Promise<ProductRecord | undefined>;
  addCategory(name: string): Promise<Category>;
  updateCategory(id: number, name: string): Promise<Category>;
  deleteCategory(id: number): Promise<boolean>;
  addAttribute(type: AttributeType, name: string): Promise<Attribute>;
  updateAttribute(id: number, name: string): Promise<Attribute>;
  deleteAttribute(id: number): Promise<boolean>;
  saveFile(
    prefix: string,
    extension: string,
    body: ArrayBuffer,
    contentType: string,
  ): Promise<string>;
  getFile(key: string): Promise<StoredFile | undefined>;
  removeFile(key: string | null | undefined): Promise<void>;
  /** Image library: shared image pool reused across products. */
  listMedia(): Promise<MediaAsset[]>;
  getMedia(id: number): Promise<MediaAsset | undefined>;
  addMedia(input: MediaInput): Promise<MediaAsset>;
  /** Removes a library image. Throws when a product still uses it. */
  deleteMedia(id: number): Promise<boolean>;
  /** Points a product at an image that already exists in the library. */
  attachMediaToProduct(
    productId: number,
    mediaId: number,
  ): Promise<Product | undefined>;
  /** Clears a product's image without removing it from the library. */
  detachProductImage(id: number): Promise<void>;
  replaceLogo(key: string): Promise<Settings>;
  saveQuotation(input: QuotationInput): Promise<Quotation>;
  listQuotations(): Promise<Quotation[]>;
  getOverview(): Promise<Overview>;
};
