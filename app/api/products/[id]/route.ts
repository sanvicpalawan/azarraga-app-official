import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRawDb } from "@/db";
import { parseId } from "@/lib/catalog-db";

const schema = z.object({
  name: z.string().trim().min(1).max(140),
  categoryId: z.number().int().positive(),
  basePrice: z.number().nonnegative(),
  description: z.string().trim().max(1200),
  defaultSeriesId: z.number().int().positive().nullable(),
  defaultGlassId: z.number().int().positive().nullable(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const input = schema.parse(await request.json());
    await getRawDb().prepare(`UPDATE products SET name = ?, category_id = ?, base_price = ?,
      description = ?, default_series_id = ?, default_glass_id = ?, updated_at = ? WHERE id = ?`)
      .bind(input.name, input.categoryId, input.basePrice, input.description, input.defaultSeriesId, input.defaultGlassId, new Date().toISOString(), id)
      .run();
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to update product", error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Check the product fields." : "The product could not be updated." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const db = getRawDb();
    const product = await db.prepare("SELECT image_key AS imageKey FROM products WHERE id = ?").bind(id).first<{ imageKey: string | null }>();
    if (product?.imageKey && env.BUCKET) await env.BUCKET.delete(product.imageKey);
    await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete product", error);
    return NextResponse.json({ error: "The product could not be deleted." }, { status: 400 });
  }
}
