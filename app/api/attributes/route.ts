import { NextResponse } from "next/server";
import { z } from "zod";
import { getRawDb } from "@/db";
import { ensureCatalogDefaults } from "@/lib/catalog-db";

const schema = z.object({ type: z.enum(["series", "glass", "color", "lock"]), name: z.string().trim().min(1).max(100) });

export async function GET() {
  await ensureCatalogDefaults();
  const rows = await getRawDb().prepare("SELECT id, type, name, sort_order AS sortOrder FROM product_attributes ORDER BY type, sort_order, name").all();
  return NextResponse.json({ attributes: rows.results });
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await ensureCatalogDefaults();
    const db = getRawDb();
    const max = await db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS value FROM product_attributes WHERE type = ?").bind(input.type).first<{ value: number }>();
    const result = await db.prepare("INSERT INTO product_attributes (type, name, sort_order) VALUES (?, ?, ?)").bind(input.type, input.name, (max?.value ?? -1) + 1).run();
    return NextResponse.json({ id: result.meta.last_row_id, created: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Choose a type and enter a name." : "That option already exists." }, { status: 400 });
  }
}
