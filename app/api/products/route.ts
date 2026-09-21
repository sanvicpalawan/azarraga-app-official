import { NextResponse } from "next/server";
import { z } from "zod";
import { getRawDb } from "@/db";
import { ensureCatalogDefaults, productImageUrl } from "@/lib/catalog-db";

export const productSchema = z.object({
  name: z.string().trim().min(1).max(140),
  categoryId: z.number().int().positive(),
  basePrice: z.number().nonnegative(),
  description: z.string().trim().max(1200),
  defaultSeriesId: z.number().int().positive().nullable(),
  defaultGlassId: z.number().int().positive().nullable(),
});

export async function GET() {
  try {
    await ensureCatalogDefaults();
    const result = await getRawDb().prepare(`SELECT p.*, c.name AS category_name,
      s.name AS default_series, g.name AS default_glass
      FROM products p JOIN product_categories c ON c.id = p.category_id
      LEFT JOIN product_attributes s ON s.id = p.default_series_id
      LEFT JOIN product_attributes g ON g.id = p.default_glass_id
      ORDER BY c.sort_order, p.name`).all();
    const products = (result.results as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      imageUrl: productImageUrl(row.id as number, row.image_key as string | null, row.image_path as string | null),
    }));
    return NextResponse.json({ products });
  } catch (error) {
    console.error("Unable to load products", error);
    return NextResponse.json({ error: "Products are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const input = productSchema.parse(await request.json());
    await ensureCatalogDefaults();
    const result = await getRawDb().prepare(`INSERT INTO products
      (name, category_id, base_price, description, default_series_id, default_glass_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(input.name, input.categoryId, input.basePrice, input.description, input.defaultSeriesId, input.defaultGlassId, new Date().toISOString())
      .run();
    return NextResponse.json({ id: result.meta.last_row_id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create product", error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Check the product fields." : "The product could not be created." }, { status: error instanceof z.ZodError ? 400 : 409 });
  }
}
