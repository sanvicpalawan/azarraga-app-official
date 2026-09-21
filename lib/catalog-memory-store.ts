import type { Attribute, Catalog, Category, Product, Settings } from "./catalog-types";
import type {
  AttributeType,
  CatalogBackend,
  Overview,
  ProductInput,
  ProductRecord,
  Quotation,
  QuotationInput,
  SettingsInput,
  StoredFile,
} from "./catalog-store-types";
import { buildDefaultCatalogData } from "./catalog-seed";

type CatalogState = {
  settings: Settings;
  categories: Category[];
  attributes: Attribute[];
  products: ProductRecord[];
  quotations: Quotation[];
  files: Map<string, StoredFile>;
  nextProductId: number;
  nextCategoryId: number;
  nextAttributeId: number;
  nextQuotationId: number;
};

function createInitialState(): CatalogState {
  const now = new Date().toISOString();
  const data = buildDefaultCatalogData(now);
  return {
    settings: { ...data.settings },
    categories: data.categories.map((category) => ({ ...category })),
    attributes: data.attributes.map((attribute) => ({ ...attribute })),
    products: data.products.map((product) => ({ ...product })),
    quotations: [],
    files: new Map(),
    nextProductId: data.products.length + 1,
    nextCategoryId: data.categories.length + 1,
    nextAttributeId: data.attributes.length + 1,
    nextQuotationId: 1,
  };
}

function getGlobalStore(): CatalogState {
  const globalWithStore = globalThis as typeof globalThis & {
    __azarragaCatalogStore?: CatalogState;
  };
  globalWithStore.__azarragaCatalogStore ??= createInitialState();
  return globalWithStore.__azarragaCatalogStore;
}

function copySettings(settings: Settings): Settings {
  return { ...settings };
}

function copyCategory(category: Category): Category {
  return { ...category };
}

function copyAttribute(attribute: Attribute): Attribute {
  return { ...attribute };
}

function toProductView(product: ProductRecord): Product {
  return {
    ...product,
    imageUrl: product.imageKey
      ? `/api/products/${product.id}/image`
      : product.imagePath,
  };
}

function findAttributeName(
  store: CatalogState,
  id: number | null,
): string | null {
  return id === null
    ? null
    : store.attributes.find((attribute) => attribute.id === id)?.name ?? null;
}

function createFileKey(prefix: string, extension: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}/${uuid}.${extension}`;
}

function removeStoredFile(key: string | null | undefined): void {
  if (key) getGlobalStore().files.delete(key);
}

let backendInstance: CatalogBackend | null = null;

/**
 * In-memory catalog store. Used for local development when DATABASE_URL is
 * not set; the data lives only for the lifetime of the server process.
 */
export function getMemoryBackend(): CatalogBackend {
  if (!backendInstance) {
    const backend: CatalogBackend = {
      async getCatalogSnapshot(): Promise<Catalog> {
        const store = getGlobalStore();
        return {
          settings: copySettings(store.settings),
          categories: store.categories.map(copyCategory),
          products: store.products.map(toProductView),
          attributes: store.attributes.map(copyAttribute),
        };
      },

      async getProduct(id: number): Promise<Product | undefined> {
        const product = getGlobalStore().products.find((item) => item.id === id);
        return product ? toProductView(product) : undefined;
      },

      async getProductRecord(id: number): Promise<ProductRecord | undefined> {
        return getGlobalStore().products.find((item) => item.id === id);
      },

      async getSettings(): Promise<Settings> {
        return copySettings(getGlobalStore().settings);
      },

      async updateSettings(input: SettingsInput): Promise<Settings> {
        const store = getGlobalStore();
        store.settings = {
          ...store.settings,
          ...input,
          updatedAt: new Date().toISOString(),
        };
        return copySettings(store.settings);
      },

      async addProduct(input: ProductInput): Promise<Product> {
        const store = getGlobalStore();
        const category = store.categories.find((item) => item.id === input.categoryId);
        if (!category) throw new Error("Category not found");
        if (
          store.products.some(
            (item) => item.categoryId === input.categoryId && item.name === input.name,
          )
        ) {
          throw new Error("Product already exists");
        }

        const product: ProductRecord = {
          id: store.nextProductId++,
          name: input.name,
          categoryId: input.categoryId,
          categoryName: category.name,
          basePrice: input.basePrice,
          description: input.description,
          defaultSeriesId: input.defaultSeriesId,
          defaultGlassId: input.defaultGlassId,
          defaultSeries: findAttributeName(store, input.defaultSeriesId),
          defaultGlass: findAttributeName(store, input.defaultGlassId),
          imageKey: null,
          imagePath: null,
          updatedAt: new Date().toISOString(),
        };
        store.products.push(product);
        return toProductView(product);
      },

      async updateProduct(id: number, input: ProductInput): Promise<Product> {
        const store = getGlobalStore();
        const product = store.products.find((item) => item.id === id);
        const category = store.categories.find((item) => item.id === input.categoryId);
        if (!product) throw new Error("Product not found");
        if (!category) throw new Error("Category not found");
        if (
          store.products.some(
            (item) =>
              item.id !== id &&
              item.categoryId === input.categoryId &&
              item.name === input.name,
          )
        ) {
          throw new Error("Product already exists");
        }

        Object.assign(product, {
          ...input,
          categoryName: category.name,
          defaultSeries: findAttributeName(store, input.defaultSeriesId),
          defaultGlass: findAttributeName(store, input.defaultGlassId),
          updatedAt: new Date().toISOString(),
        });
        return toProductView(product);
      },

      async deleteProduct(id: number): Promise<ProductRecord | undefined> {
        const store = getGlobalStore();
        const index = store.products.findIndex((item) => item.id === id);
        if (index < 0) return undefined;
        const [product] = store.products.splice(index, 1);
        removeStoredFile(product.imageKey);
        return product;
      },

      async addCategory(name: string): Promise<Category> {
        const store = getGlobalStore();
        if (store.categories.some((item) => item.name === name)) {
          throw new Error("Category already exists");
        }
        const category: Category = {
          id: store.nextCategoryId++,
          name,
          sortOrder: store.categories.length,
        };
        store.categories.push(category);
        return copyCategory(category);
      },

      async updateCategory(id: number, name: string): Promise<Category> {
        const store = getGlobalStore();
        const category = store.categories.find((item) => item.id === id);
        if (!category) throw new Error("Category not found");
        if (store.categories.some((item) => item.id !== id && item.name === name)) {
          throw new Error("Category already exists");
        }
        category.name = name;
        store.products.forEach((product) => {
          if (product.categoryId === id) product.categoryName = name;
        });
        return copyCategory(category);
      },

      async deleteCategory(id: number): Promise<boolean> {
        const store = getGlobalStore();
        if (store.products.some((item) => item.categoryId === id)) {
          throw new Error("Category is in use");
        }
        const index = store.categories.findIndex((item) => item.id === id);
        if (index < 0) return false;
        store.categories.splice(index, 1);
        return true;
      },

      async addAttribute(type: AttributeType, name: string): Promise<Attribute> {
        const store = getGlobalStore();
        if (store.attributes.some((item) => item.type === type && item.name === name)) {
          throw new Error("Attribute already exists");
        }
        const sortOrder = store.attributes
          .filter((item) => item.type === type)
          .reduce((highest, item) => Math.max(highest, item.sortOrder), -1) + 1;
        const attribute: Attribute = {
          id: store.nextAttributeId++,
          type,
          name,
          sortOrder,
        };
        store.attributes.push(attribute);
        return copyAttribute(attribute);
      },

      async updateAttribute(id: number, name: string): Promise<Attribute> {
        const store = getGlobalStore();
        const attribute = store.attributes.find((item) => item.id === id);
        if (!attribute) throw new Error("Attribute not found");
        if (
          store.attributes.some(
            (item) =>
              item.id !== id && item.type === attribute.type && item.name === name,
          )
        ) {
          throw new Error("Attribute already exists");
        }
        attribute.name = name;
        store.products.forEach((product) => {
          if (product.defaultSeriesId === id) product.defaultSeries = name;
          if (product.defaultGlassId === id) product.defaultGlass = name;
        });
        return copyAttribute(attribute);
      },

      async deleteAttribute(id: number): Promise<boolean> {
        const store = getGlobalStore();
        if (
          store.products.some(
            (product) =>
              product.defaultSeriesId === id || product.defaultGlassId === id,
          )
        ) {
          throw new Error("Attribute is in use");
        }
        const index = store.attributes.findIndex((item) => item.id === id);
        if (index < 0) return false;
        store.attributes.splice(index, 1);
        return true;
      },

      async saveFile(
        prefix: string,
        extension: string,
        body: ArrayBuffer,
        contentType: string,
      ): Promise<string> {
        const store = getGlobalStore();
        const key = createFileKey(prefix, extension);
        store.files.set(key, {
          body,
          contentType,
          etag: `"${key.replace(/[^a-z0-9]/gi, "")}"`,
        });
        return key;
      },

      async getFile(key: string): Promise<StoredFile | undefined> {
        return getGlobalStore().files.get(key);
      },

      async removeFile(key: string | null | undefined): Promise<void> {
        removeStoredFile(key);
      },

      async replaceProductImage(
        id: number,
        key: string,
      ): Promise<Product | undefined> {
        const store = getGlobalStore();
        const product = store.products.find((item) => item.id === id);
        if (!product) return undefined;
        removeStoredFile(product.imageKey);
        product.imageKey = key;
        product.imagePath = null;
        product.updatedAt = new Date().toISOString();
        return toProductView(product);
      },

      async clearProductImage(id: number): Promise<void> {
        const store = getGlobalStore();
        const product = store.products.find((item) => item.id === id);
        if (!product) return;
        removeStoredFile(product.imageKey);
        product.imageKey = null;
        product.imagePath = null;
        product.updatedAt = new Date().toISOString();
      },

      async replaceLogo(key: string): Promise<Settings> {
        const store = getGlobalStore();
        removeStoredFile(store.settings.logoKey);
        store.settings.logoKey = key;
        store.settings.updatedAt = new Date().toISOString();
        return copySettings(store.settings);
      },

      async saveQuotation(input: QuotationInput): Promise<Quotation> {
        const store = getGlobalStore();
        const now = new Date().toISOString();
        const existing = store.quotations.find(
          (quotation) => quotation.quotationNumber === input.quotationNumber,
        );
        const quotation: Quotation = {
          ...input,
          item: { ...input.item },
          id: existing?.id ?? store.nextQuotationId++,
          status: "draft",
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        if (existing) {
          const index = store.quotations.indexOf(existing);
          store.quotations[index] = quotation;
        } else {
          store.quotations.push(quotation);
        }
        return { ...quotation, item: { ...quotation.item } };
      },

      async listQuotations(): Promise<Quotation[]> {
        return getGlobalStore()
          .quotations.slice()
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 25)
          .map((quotation) => ({ ...quotation, item: { ...quotation.item } }));
      },

      async getOverview(): Promise<Overview> {
        const store = getGlobalStore();
        return {
          totalQuotes: store.quotations.length,
          totalRevenue: store.quotations.reduce(
            (total, quotation) => total + quotation.grandTotal,
            0,
          ),
          totalSqft: store.quotations.reduce(
            (total, quotation) => total + quotation.totalSqft,
            0,
          ),
          totalProducts: store.products.length,
          totalCategories: store.categories.length,
        };
      },
    };
    backendInstance = backend;
  }
  return backendInstance;
}
