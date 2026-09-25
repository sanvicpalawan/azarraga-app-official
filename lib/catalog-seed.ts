import type { Attribute, Category, Settings } from "./catalog-types";
import type { ProductRecord } from "./catalog-store-types";

// Operational starting structure only. The old sample catalog is archived in
// fixtures/legacy-catalog.ts and is never loaded into a real customer account.
export function buildDefaultCatalogData(now: string): {
  settings: Settings;
  categories: Category[];
  attributes: Attribute[];
  products: ProductRecord[];
} {
  return {
    settings: {
      id: 1,
      companyName: "Azarraga Glass & Aluminum",
      logoKey: null,
      address: "",
      contactNumbers: "",
      email: "",
      tin: "",
      bankAccountName: "",
      bankAccountNumber: "",
      bankName: "",
      bankBranch: "",
      termsConditions: "",
      pdfHeader: "AZARRAGA GLASS & ALUMINUM — QUOTATION",
      updatedAt: now,
    },
    categories: ["Windows", "Doors", "Others"].map((name, index) => ({
      id: index + 1,
      name,
      sortOrder: index,
    })),
    attributes: [],
    products: [],
  };
}
