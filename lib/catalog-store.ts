import type { Attribute, Catalog, Category, FinishedProject, FinishedProjectInput, Product, Settings } from "./catalog-types";
import type {
  AttributeType,
  CatalogBackend,
  MediaAsset,
  MediaInput,
  Overview,
  ProductInput,
  ProductRecord,
  Quotation,
  QuotationInput,
  SettingsInput,
  StoredFile,
} from "./catalog-store-types";
import { getDbBackend } from "./catalog-db-store";
import { getMemoryBackend } from "./catalog-memory-store";

export type {
  AttributeType,
  FinishedProject,
  FinishedProjectInput,
  FinishedProjectItem,
  MediaAsset,
  MediaInput,
  MediaUsage,
  Overview,
  ProductInput,
  Quotation,
  QuotationInput,
  QuotationItem,
  SettingsInput,
  StoredFile,
} from "./catalog-store-types";

let backend: CatalogBackend | null = null;

/**
 * Returns the active catalog backend. When DATABASE_URL is set, the catalog,
 * quotations, and uploaded files live in Neon Postgres. Local development
 * may use temporary in-memory storage, but production must have a database.
 */
function getStore(): CatalogBackend {
  if (!backend) {
    if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production; refusing temporary in-memory storage.");
    }
    backend = process.env.DATABASE_URL ? getDbBackend() : getMemoryBackend();
  }
  return backend;
}

export async function getCatalogSnapshot(): Promise<Catalog> {
  return getStore().getCatalogSnapshot();
}

export async function getProduct(id: number): Promise<Product | undefined> {
  return getStore().getProduct(id);
}

export async function getProductRecord(id: number): Promise<ProductRecord | undefined> {
  return getStore().getProductRecord(id);
}

export async function getSettings(): Promise<Settings> {
  return getStore().getSettings();
}

export async function updateSettings(input: SettingsInput): Promise<Settings> {
  return getStore().updateSettings(input);
}

export async function addProduct(input: ProductInput): Promise<Product> {
  return getStore().addProduct(input);
}

export async function updateProduct(id: number, input: ProductInput): Promise<Product> {
  return getStore().updateProduct(id, input);
}

export async function deleteProduct(id: number): Promise<ProductRecord | undefined> {
  return getStore().deleteProduct(id);
}

export async function addCategory(name: string): Promise<Category> {
  return getStore().addCategory(name);
}

export async function updateCategory(id: number, name: string): Promise<Category> {
  return getStore().updateCategory(id, name);
}

export async function deleteCategory(id: number): Promise<boolean> {
  return getStore().deleteCategory(id);
}

export async function addAttribute(type: AttributeType, name: string): Promise<Attribute> {
  return getStore().addAttribute(type, name);
}

export async function updateAttribute(id: number, name: string): Promise<Attribute> {
  return getStore().updateAttribute(id, name);
}

export async function deleteAttribute(id: number): Promise<boolean> {
  return getStore().deleteAttribute(id);
}

export async function saveFile(
  prefix: string,
  extension: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<string> {
  return getStore().saveFile(prefix, extension, body, contentType);
}

export async function getFile(key: string): Promise<StoredFile | undefined> {
  return getStore().getFile(key);
}

export async function removeFile(key: string | null | undefined): Promise<void> {
  return getStore().removeFile(key);
}

export async function listMedia(): Promise<MediaAsset[]> {
  return getStore().listMedia();
}

export async function getMedia(id: number): Promise<MediaAsset | undefined> {
  return getStore().getMedia(id);
}

export async function addMedia(input: MediaInput): Promise<MediaAsset> {
  return getStore().addMedia(input);
}

export async function deleteMedia(id: number): Promise<boolean> {
  return getStore().deleteMedia(id);
}

export async function attachMediaToProduct(
  productId: number,
  mediaId: number,
): Promise<Product | undefined> {
  return getStore().attachMediaToProduct(productId, mediaId);
}

export async function detachProductImage(id: number): Promise<void> {
  return getStore().detachProductImage(id);
}

export async function replaceLogo(key: string): Promise<Settings> {
  return getStore().replaceLogo(key);
}

export async function saveQuotation(input: QuotationInput): Promise<Quotation> {
  return getStore().saveQuotation(input);
}

export async function listQuotations(): Promise<Quotation[]> {
  return getStore().listQuotations();
}

export async function getOverview(): Promise<Overview> {
  return getStore().getOverview();
}

export async function listProjects(): Promise<FinishedProject[]> {
  return getStore().listProjects();
}

export async function getProject(id: number): Promise<FinishedProject | undefined> {
  return getStore().getProject(id);
}

export async function saveProject(input: FinishedProjectInput): Promise<FinishedProject> {
  return getStore().saveProject(input);
}

export async function deleteProject(id: number): Promise<boolean> {
  return getStore().deleteProject(id);
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid ID");
  return id;
}

export function productImageUrl(
  id: number,
  imageKey: string | null,
  imagePath: string | null,
): string | null {
  return imageKey ? `/api/products/${id}/image` : imagePath;
}
