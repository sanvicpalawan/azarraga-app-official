import type { Attribute, Category, Settings } from "./catalog-types";
import type { ProductRecord } from "./catalog-store-types";

export const defaultTerms =
  "70% Down Payment, 30% upon Installation. Lead Time: 30-45 Working Days. Delivery and labor included. Down Payment is non-refundable.";

const defaultAttributes: Record<Attribute["type"], string[]> = {
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

type DefaultProductSeed = {
  name: string;
  category: string;
  basePrice: number;
  description: string;
  series: string | null;
  glass: string | null;
  imagePath: string | null;
};

const defaultProducts: DefaultProductSeed[] = [
  { name: "2 Panel Sliding Window", category: "Windows", basePrice: 1250, description: "Sliding window with two operable panels.", series: "Series 798", glass: "6mm Annealed", imagePath: "/product-images/2-panel-sliding-window.svg" },
  { name: "3 Panel Sliding Window", category: "Windows", basePrice: 1550, description: "Sliding window with three panels.", series: "Series 798", glass: "6mm Annealed", imagePath: "/product-images/3-panel-sliding-window.svg" },
  { name: "4 Panel Sliding Window", category: "Windows", basePrice: 1850, description: "Sliding window with four panels.", series: "Series 798", glass: "6mm Annealed", imagePath: "/four-panel-window.png" },
  { name: "2 Panel Sliding + Net", category: "Windows", basePrice: 1450, description: "Sliding window with insect screen.", series: "Series 798", glass: "6mm Annealed", imagePath: "/product-images/2-panel-sliding-net.svg" },
  { name: "3 Panel Sliding + Net", category: "Windows", basePrice: 1750, description: "Three-panel sliding window with insect screen.", series: "Series 798", glass: "6mm Annealed", imagePath: "/product-images/3-panel-sliding-net.svg" },
  { name: "Awning Window", category: "Windows", basePrice: 1100, description: "Top-hinged aluminum awning window.", series: "Series 38", glass: "6mm Annealed", imagePath: "/product-images/awning-window.svg" },
  { name: "Jalousie Window", category: "Windows", basePrice: 950, description: "Adjustable glass-louver ventilation window.", series: "4-inch", glass: "6mm Annealed", imagePath: "/product-images/jalousie-window.svg" },
  { name: "Fixed Window", category: "Windows", basePrice: 900, description: "Fixed aluminum and glass panel.", series: "Middle-end", glass: "6mm Annealed", imagePath: "/product-images/fixed-window.svg" },
  { name: "Folding Window", category: "Windows", basePrice: 2200, description: "Multi-panel folding window.", series: "Series 900", glass: "6mm Annealed", imagePath: "/product-images/folding-window.svg" },
  { name: "Bi-Fold Door", category: "Doors", basePrice: 3200, description: "Folding aluminum and glass door.", series: "Series 900", glass: "6mm Annealed", imagePath: "/product-images/bi-fold-door.svg" },
  { name: "Sliding Door", category: "Doors", basePrice: 2400, description: "Aluminum framed sliding door.", series: "Series 900", glass: "6mm Annealed", imagePath: "/product-images/sliding-door.svg" },
  { name: "Casement / Swing Door", category: "Doors", basePrice: 2800, description: "Hinged aluminum and glass door.", series: "Series 50", glass: "6mm Annealed", imagePath: "/product-images/casement-swing-door.svg" },
  { name: "Roll-Up Door", category: "Doors", basePrice: 3500, description: "Heavy-duty roll-up door assembly.", series: null, glass: null, imagePath: "/product-images/roll-up-door.svg" },
  { name: "Hanging Door", category: "Doors", basePrice: 2900, description: "Top-hung sliding door.", series: "Series 900", glass: "10mm Annealed", imagePath: "/product-images/hanging-door.svg" },
  { name: "Double Leaf ED Door", category: "Doors", basePrice: 18500, description: "10mm annealed glass, standard size 1.65m × 2.10m.", series: null, glass: "10mm Annealed", imagePath: "/product-images/double-leaf-ed-door.svg" },
  { name: "Single Leaf ED Door", category: "Doors", basePrice: 9800, description: "10mm annealed glass, standard size 0.90m × 2.10m.", series: null, glass: "10mm Annealed", imagePath: "/product-images/single-leaf-ed-door.svg" },
  { name: "Skylight", category: "Others", basePrice: 3800, description: "Custom aluminum and glass skylight.", series: null, glass: "Tempered", imagePath: "/product-images/skylight.svg" },
  { name: "Glass Railings", category: "Others", basePrice: 2600, description: "Custom glass railing system.", series: null, glass: "Tempered", imagePath: "/product-images/glass-railings.svg" },
  { name: "Sunroom", category: "Others", basePrice: 4500, description: "Custom glazed sunroom enclosure.", series: null, glass: "Tempered", imagePath: "/product-images/sunroom.svg" },
  { name: "Stainless Steel Works", category: "Others", basePrice: 2100, description: "Custom stainless steel fabrication.", series: null, glass: null, imagePath: "/product-images/stainless-steel-works.svg" },
  { name: "ACP Cladding", category: "Others", basePrice: 1900, description: "Aluminum composite panel cladding.", series: null, glass: null, imagePath: "/product-images/acp-cladding.svg" },
  { name: "Mullion", category: "Others", basePrice: 1400, description: "Structural aluminum mullion assembly.", series: null, glass: "6mm Annealed", imagePath: "/product-images/mullion.svg" },
  { name: "Glass Shelves", category: "Others", basePrice: 850, description: "Made-to-measure glass shelves.", series: null, glass: "Tempered", imagePath: "/product-images/glass-shelves.svg" },
  { name: "Table Top Glass", category: "Others", basePrice: 1100, description: "Custom cut table top glass.", series: null, glass: "Tempered", imagePath: "/product-images/table-top-glass.svg" },
  { name: "Cabinets", category: "Others", basePrice: 3100, description: "Aluminum and glass cabinet system.", series: null, glass: "6mm Annealed", imagePath: "/product-images/cabinets.svg" },
  { name: "Canopy", category: "Others", basePrice: 3600, description: "Aluminum and glass canopy.", series: null, glass: "Tempered", imagePath: "/product-images/canopy.svg" },
  { name: "Slide Up", category: "Others", basePrice: 1650, description: "Vertical slide-up service window.", series: "Series 798", glass: "6mm Annealed", imagePath: "/product-images/slide-up.svg" },
  { name: "Fixed-Sliding Counter Window", category: "Others", basePrice: 1950, description: "Combination fixed and sliding counter window.", series: "Series 798", glass: "6mm Annealed", imagePath: "/product-images/fixed-sliding-counter-window.svg" },
];

export type DefaultCatalogData = {
  settings: Settings;
  categories: Category[];
  attributes: Attribute[];
  products: ProductRecord[];
};

const attributeTypeOrder: readonly Attribute["type"][] = [
  "series",
  "glass",
  "color",
  "lock",
];

/**
 * Builds the default catalog with stable ids (categories 1-3, attributes
 * 1-21, products 1-28). Used both by the in-memory store and by the Postgres
 * seed so both backends start from the exact same data.
 */
export function buildDefaultCatalogData(now: string): DefaultCatalogData {
  const categories: Category[] = ["Windows", "Doors", "Others"].map(
    (name, index) => ({ id: index + 1, name, sortOrder: index }),
  );
  const categoryIdByName = new Map(
    categories.map((category) => [category.name, category.id]),
  );

  const attributes: Attribute[] = [];
  const attributeIdByTypeAndName = new Map<string, number>();
  let nextAttributeId = 1;
  for (const type of attributeTypeOrder) {
    defaultAttributes[type].forEach((name, sortOrder) => {
      const id = nextAttributeId++;
      attributes.push({ id, type, name, sortOrder });
      attributeIdByTypeAndName.set(`${type}:${name}`, id);
    });
  }

  const products: ProductRecord[] = defaultProducts.map((entry, index) => ({
    id: index + 1,
    name: entry.name,
    categoryId: categoryIdByName.get(entry.category) ?? 1,
    categoryName: entry.category,
    basePrice: entry.basePrice,
    description: entry.description,
    defaultSeriesId: entry.series
      ? (attributeIdByTypeAndName.get(`series:${entry.series}`) ?? null)
      : null,
    defaultGlassId: entry.glass
      ? (attributeIdByTypeAndName.get(`glass:${entry.glass}`) ?? null)
      : null,
    defaultSeries: entry.series,
    defaultGlass: entry.glass,
    imageKey: null,
    imagePath: entry.imagePath,
    productKey: null,
    designId: null,
    isCustom: false,
    updatedAt: now,
  }));

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
  };
}
