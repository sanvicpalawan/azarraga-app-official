/**
 * Reads the spec dropdowns the quote editor is built from:
 *   Series -> Type -> Frame -> Glass, plus category code prefixes
 *   and the catalog items used for price memory.
 *
 * Everything here is read-only and safe to call from server components.
 */
import { asc, eq } from "drizzle-orm";
import { isLocalPreview } from "./local-preview";
import { getDrizzle, getRawSql, readyDocumentSchema } from "./db/client";
import { usesDocumentMemory } from "./document-memory";
import { getCatalogSnapshot } from "./catalog-store";
import { items, optionGroups, options } from "./db/schema";

export interface SpecOption {
  id: string;
  label: string;
  priceAdjustment: number;
}

export interface SpecGroup {
  id: string;
  name: string;
  joinWithPrevious: boolean;
  sortOrder: number;
  options: SpecOption[];
}

/** Groups in dropdown order, each with its options sorted. */
export async function loadSpecGroups(): Promise<SpecGroup[]> {
  if (isLocalPreview()) return [];
  if (usesDocumentMemory()) return [];
  await readyDocumentSchema();
  const db = getDrizzle();
  const [groups, allOptions] = await Promise.all([
    db.select().from(optionGroups).orderBy(asc(optionGroups.sortOrder)),
    db.select().from(options).orderBy(asc(options.sortOrder)),
  ]);

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    joinWithPrevious: g.joinWithPrevious,
    sortOrder: g.sortOrder,
    options: allOptions
      .filter((o) => o.groupId === g.id && o.active)
      .map((o) => ({
        id: o.id,
        label: o.label,
        priceAdjustment: Number(o.priceAdjustment),
      })),
  }));
}

export interface CategoryWithPrefix {
  id: number | string;
  name: string;
  codePrefix: string;
}

/**
 * The legacy `categories` table is integer-keyed and shared with the
 * product catalog, so it is read through plain SQL rather than Drizzle.
 */
export async function loadCategoriesWithPrefix(): Promise<CategoryWithPrefix[]> {
  if (isLocalPreview()) return [{ id: 1, name: "Windows", codePrefix: "W" }, { id: 2, name: "Doors", codePrefix: "D" }];
  if (usesDocumentMemory()) return (await getCatalogSnapshot()).categories.map((category)=>({id:category.id,name:category.name,codePrefix:category.name==="Windows"?"W":category.name==="Doors"?"D":"O"}));
  await readyDocumentSchema();
  const raw = getRawSql();
  const rows = await raw`
    select id, name, code_prefix from categories order by id
  `;
  return rows.map((r) => ({
    id: typeof r.id === "number" ? r.id : String(r.id),
    name: String(r.name),
    codePrefix: (r.code_prefix as string | null) ?? "",
  }));
}

export interface CatalogItem {
  id: string;
  name: string;
  unit: string;
  unitPrice: number;
}

/** Items seeded from the product catalog; unitPrice is a reference only. */
export async function loadItems(): Promise<CatalogItem[]> {
  if (isLocalPreview()) return [];
  if (usesDocumentMemory()) return [];
  await readyDocumentSchema();
  const db = getDrizzle();
  const rows = await db
    .select({
      id: items.id,
      name: items.name,
      unit: items.unit,
      unitPrice: items.unitPrice,
    })
    .from(items)
    .where(eq(items.active, true))
    .orderBy(asc(items.name));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    unitPrice: Number(r.unitPrice),
  }));
}
