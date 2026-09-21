import type {
  Attribute,
  Catalog,
  Category,
  Product,
  Settings,
} from "@/lib/catalog-types";

export type AttributeType = Attribute["type"];

export type ProductInput = {
  name: string;
  categoryId: number;
  basePrice: number;
  description: string;
  defaultSeriesId: number | null;
  defaultGlassId: number | null;
};

export type SettingsInput = Omit<
  Settings,
  "id" | "logoKey" | "updatedAt"
>;

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

type ProductRecord = Omit<Product, "imageUrl">;

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

const defaultTerms =
  "70% Down Payment, 30% upon Installation. Lead Time: 30-45 Working Days. Delivery and labor included. Down Payment is non-refundable.";

const defaultAttributes: Record<AttributeType, string[]> = {
  series: [
    "Series 798",
    "Series 900",
    "Series 868",
    "Series 130",
    "Series 38",
    "Series 50",
    "Series 60",
    "4-inch",
    "6-inch",
    "Low-end",
    "Middle-end",
    "Frameless",
    "Awning / High-end",
  ],
  glass: ["6mm Annealed", "10mm Annealed", "Tempered"],
  color: ["Dark Bronze", "White", "Analok"],
  lock: ["Standard Crescent", "Heavy Duty"],
};

const defaultProducts = [
  [
    "2 Panel Sliding Window",
    "Windows",
    0,
    "Sliding window with two operable panels.",
    "Series 798",
    "6mm Annealed",
    null,
  ],
  [
    "3 Panel Sliding Window",
    "Windows",
    0,
    "Sliding window with three panels.",
    "Series 798",
    "6mm Annealed",
    null,
  ],
  [
    "4 Panel Sliding Window",
    "Windows",
    1850,
    "Sliding window with four panels.",
    "Series 798",
    "6mm Annealed",
    "/four-panel-window.png",
  ],
  [
    "2 Panel Sliding + Net",
    "Windows",
    0,
    "Sliding window with insect screen.",
    "Series 798",
    "6mm Annealed",
    null,
  ],
  [
    "3 Panel Sliding + Net",
    "Windows",
    0,
    "Three-panel sliding window with insect screen.",
    "Series 798",
    "6mm Annealed",
    null,
  ],
  [
    "Awning Window",
    "Windows",
    0,
    "Top-hinged aluminum awning window.",
    "Series 38",
    "6mm Annealed",
    null,
  ],
  [
    "Jalousie Window",
    "Windows",
    0,
    "Adjustable glass-louver ventilation window.",
    "4-inch",
    "6mm Annealed",
    null,
  ],
  [
    "Fixed Window",
    "Windows",
    0,
    "Fixed aluminum and glass panel.",
    "Middle-end",
    "6mm Annealed",
    null,
  ],
  [
    "Folding Window",
    "Windows",
    0,
    "Multi-panel folding window.",
    "Series 900",
    "6mm Annealed",
    null,
  ],
  [
    "Bi-Fold Door",
    "Doors",
    0,
    "Folding aluminum and glass door.",
    "Series 900",
    "6mm Annealed",
    null,
  ],
  [
    "Sliding Door",
    "Doors",
    0,
    "Aluminum framed sliding door.",
    "Series 900",
    "6mm Annealed",
    null,
  ],
  [
    "Casement / Swing Door",
    "Doors",
    0,
    "Hinged aluminum and glass door.",
    "Series 50",
    "6mm Annealed",
    null,
  ],
  ["Roll-Up Door", "Doors", 0, "Heavy-duty roll-up door assembly.", null, null, null],
  [
    "Hanging Door",
    "Doors",
    0,
    "Top-hung sliding door.",
    "Series 900",
    "10mm Annealed",
    null,
  ],
  [
    "Double Leaf ED Door",
    "Doors",
    0,
    "10mm annealed glass, standard size 1.65m × 2.10m.",
    null,
    "10mm Annealed",
    null,
  ],
  [
    "Single Leaf ED Door",
    "Doors",
    0,
    "10mm annealed glass, standard size 0.90m × 2.10m.",
    null,
    "10mm Annealed",
    null,
  ],
  [
    "Skylight",
    "Others",
    0,
    "Custom aluminum and glass skylight.",
    null,
    "Tempered",
    null,
  ],
  [
    "Glass Railings",
    "Others",
    0,
    "Custom glass railing system.",
    null,
    "Tempered",
    null,
  ],
  [
    "Sunroom",
    "Others",
    0,
    "Custom glazed sunroom enclosure.",
    null,
    "Tempered",
    null,
  ],
  [
    "Stainless Steel Works",
    "Others",
    0,
    "Custom stainless steel fabrication.",
    null,
    null,
    null,
  ],
  [
    "ACP Cladding",
    "Others",
    0,
    "Aluminum composite panel cladding.",
    null,
    null,
    null,
  ],
  [
    "Mullion",
    "Others",
    0,
    "Structural aluminum mullion assembly.",
    null,
    "6mm Annealed",
    null,
  ],
  [
    "Glass Shelves",
    "Others",
    0,
    "Made-to-measure glass shelves.",
    null,
    "Tempered",
    null,
  ],
  [
    "Table Top Glass",
    "Others",
    0,
    "Custom cut table top glass.",
    null,
    "Tempered",
    null,
  ],
  [
    "Cabinets",
    "Others",
    0,
    "Aluminum and glass cabinet system.",
    null,
    "6mm Annealed",
    null,
  ],
  [
    "Canopy",
    "Others",
    0,
    "Aluminum and glass canopy.",
    null,
    "Tempered",
    null,
  ],
  [
    "Slide Up",
    "Others",
    0,
    "Vertical slide-up service window.",
    "Series 798",
    "6mm Annealed",
    null,
  ],
  [
    "Fixed-Sliding Counter Window",
    "Others",
    0,
    "Combination fixed and sliding counter window.",
    "Series 798",
    "6mm Annealed",
    null,
  ],
] as const;

function createInitialState(): CatalogState {
  const now = new Date().toISOString();
  const categories: Category[] = ["Windows", "Doors", "Others"].map(
    (name, index) => ({ id: index + 1, name, sortOrder: index }),
  );
  const categoryIdByName = new Map(
    categories.map((category) => [category.name, category.id]),
  );

  const attributes: Attribute[] = [];
  const attributeIdByTypeAndName = new Map<string, number>();
  let nextAttributeId = 1;
  for (const [type, names] of Object.entries(defaultAttributes) as [
    AttributeType,
    string[],
  ][]) {
    names.forEach((name, sortOrder) => {
      const id = nextAttributeId++;
      attributes.push({ id, type, name, sortOrder });
      attributeIdByTypeAndName.set(`${type}:${name}`, id);
    });
  }

  const products: ProductRecord[] = defaultProducts.map(
    ([name, categoryName, basePrice, description, series, glass, imagePath], index) => ({
      id: index + 1,
      name,
      categoryId: categoryIdByName.get(categoryName)!,
      categoryName,
      basePrice,
      description,
      defaultSeriesId: series
        ? attributeIdByTypeAndName.get(`series:${series}`) ?? null
        : null,
      defaultGlassId: glass
        ? attributeIdByTypeAndName.get(`glass:${glass}`) ?? null
        : null,
      defaultSeries: series,
      defaultGlass: glass,
      imageKey: null,
      imagePath,
      updatedAt: now,
    }),
  );

  return {
    settings: {
      id: 1,
      companyName: "Azarraga Glass & Aluminum",
      logoKey: null,
      address: "Palawan, Philippines",
      contactNumbers: "0945-1308277 / 0999-7057770",
      email: "",
      tin: "",
      bankAccountName: "Azarraga Glass & Aluminum",
      bankAccountNumber: "",
      bankName: "",
      bankBranch: "",
      termsConditions: defaultTerms,
      pdfHeader: "AZARRAGA GLASS & ALUMINUM — QUOTATION",
      updatedAt: now,
    },
    categories,
    attributes,
    products,
    quotations: [],
    files: new Map(),
    nextProductId: products.length + 1,
    nextCategoryId: categories.length + 1,
    nextAttributeId,
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

export function getCatalogSnapshot(): Catalog {
  const store = getGlobalStore();
  return {
    settings: copySettings(store.settings),
    categories: store.categories.map(copyCategory),
    products: store.products.map(toProductView),
    attributes: store.attributes.map(copyAttribute),
  };
}

export function getProduct(id: number): Product | undefined {
  const product = getGlobalStore().products.find((item) => item.id === id);
  return product ? toProductView(product) : undefined;
}

export function getProductRecord(id: number): ProductRecord | undefined {
  return getGlobalStore().products.find((item) => item.id === id);
}

export function getSettings(): Settings {
  return copySettings(getGlobalStore().settings);
}

export function updateSettings(input: SettingsInput): Settings {
  const store = getGlobalStore();
  store.settings = {
    ...store.settings,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  return getSettings();
}

export function addProduct(input: ProductInput): Product {
  const store = getGlobalStore();
  const category = store.categories.find((item) => item.id === input.categoryId);
  if (!category) throw new Error("Category not found");
  if (store.products.some((item) => item.categoryId === input.categoryId && item.name === input.name)) {
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
}

export function updateProduct(id: number, input: ProductInput): Product {
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
}

export function deleteProduct(id: number): ProductRecord | undefined {
  const store = getGlobalStore();
  const index = store.products.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  const [product] = store.products.splice(index, 1);
  if (product.imageKey) store.files.delete(product.imageKey);
  return product;
}

export function addCategory(name: string): Category {
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
}

export function updateCategory(id: number, name: string): Category {
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
}

export function deleteCategory(id: number): boolean {
  const store = getGlobalStore();
  if (store.products.some((item) => item.categoryId === id)) {
    throw new Error("Category is in use");
  }
  const index = store.categories.findIndex((item) => item.id === id);
  if (index < 0) return false;
  store.categories.splice(index, 1);
  return true;
}

export function addAttribute(type: AttributeType, name: string): Attribute {
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
}

export function updateAttribute(id: number, name: string): Attribute {
  const store = getGlobalStore();
  const attribute = store.attributes.find((item) => item.id === id);
  if (!attribute) throw new Error("Attribute not found");
  if (
    store.attributes.some(
      (item) => item.id !== id && item.type === attribute.type && item.name === name,
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
}

export function deleteAttribute(id: number): boolean {
  const store = getGlobalStore();
  if (
    store.products.some(
      (product) => product.defaultSeriesId === id || product.defaultGlassId === id,
    )
  ) {
    throw new Error("Attribute is in use");
  }
  const index = store.attributes.findIndex((item) => item.id === id);
  if (index < 0) return false;
  store.attributes.splice(index, 1);
  return true;
}

function findAttributeName(store: CatalogState, id: number | null): string | null {
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

export function saveFile(
  prefix: string,
  extension: string,
  body: ArrayBuffer,
  contentType: string,
): string {
  const store = getGlobalStore();
  const key = createFileKey(prefix, extension);
  store.files.set(key, {
    body,
    contentType,
    etag: `"${key.replace(/[^a-z0-9]/gi, "")}"`,
  });
  return key;
}

export function getFile(key: string): StoredFile | undefined {
  return getGlobalStore().files.get(key);
}

export function removeFile(key: string | null | undefined): void {
  if (key) getGlobalStore().files.delete(key);
}

export function replaceProductImage(
  id: number,
  key: string,
): Product | undefined {
  const store = getGlobalStore();
  const product = store.products.find((item) => item.id === id);
  if (!product) return undefined;
  removeFile(product.imageKey);
  product.imageKey = key;
  product.imagePath = null;
  product.updatedAt = new Date().toISOString();
  return toProductView(product);
}

export function replaceLogo(key: string): Settings {
  const store = getGlobalStore();
  removeFile(store.settings.logoKey);
  store.settings.logoKey = key;
  store.settings.updatedAt = new Date().toISOString();
  return getSettings();
}

export function saveQuotation(input: QuotationInput): Quotation {
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
}

export function listQuotations(): Quotation[] {
  return getGlobalStore()
    .quotations.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 25)
    .map((quotation) => ({ ...quotation, item: { ...quotation.item } }));
}

export function getOverview() {
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
