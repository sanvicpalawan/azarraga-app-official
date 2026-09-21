import { NextResponse } from "next/server";
import { z } from "zod";
import { getRawDb } from "@/db";
import { ensureCatalogDefaults } from "@/lib/catalog-db";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  await ensureCatalogDefaults();
  const rows = await getRawDb().prepare("SELECT id, name, sort_order AS sortOrder FROM product_categories ORDER BY sort_order, name").all();
  return NextResponse.json({ categories: rows.results });
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await ensureCatalogDefaults();
    const db = getRawDb();
    const max = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS value FROM product_categories").first<{ value: number }>();
    const result = await db.prepare("INSERT INTO product_categories (name, sort_order) VALUES (?, ?)").bind(input.name, (max?.value ?? -1) + 1).run();
    return NextResponse.json({ id: result.meta.last_row_id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create category", error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Enter a category name." : "That category already exists." }, { status: 400 });
  }
}
