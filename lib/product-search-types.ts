export const PRODUCT_SELECTED_EVENT = "azarraga:product-selected";
export type ProductSearchCategory = "Windows" | "Doors" | "Others";
export type ProductSearchHit = {
  key: string; kind: "source" | "catalog"; name: string; description: string;
  category: ProductSearchCategory; imageUrl: string | null;
  widthMm: number | null; heightMm: number | null; unitPrice: number | null;
  currency: "PHP" | "USD" | "EUR"; unit: string; historical: boolean;
  sourceProjectId?: number; sourceItemId?: string; productId?: number;
  sourceName: string | null; sourceFile: string | null; sourceNumber: string | null;
  sourceDate: string | null; reviewRequired: boolean;
  series?: string; glass?: string; finish?: string;
  itemCode?: string;
};
export type ProductSearchPage = { items: ProductSearchHit[]; total: number; page: number; pageSize: number; totalPages: number };
export type ProductSearchOptions = { q?: string; category?: string; page?: number; pageSize?: number; kind?: "all" | "source" | "catalog"; drawingsOnly?: boolean };
