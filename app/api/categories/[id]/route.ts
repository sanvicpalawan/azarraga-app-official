import { NextResponse } from "next/server";
import { z } from "zod";
import { getRawDb } from "@/db";
import { parseId } from "@/lib/catalog-db";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const input = schema.parse(await request.json());
    await getRawDb().prepare("UPDATE product_categories SET name = ? WHERE id = ?").bind(input.name, id).run();
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Enter a category name." : "Category could not be updated." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const db = getRawDb();
    const used = await db.prepare("SELECT COUNT(*) AS count FROM products WHERE category_id = ?").bind(id).first<{ count: number }>();
    if (used?.count) return NextResponse.json({ error: "Move or delete the products in this category first." }, { status: 409 });
    await db.prepare("DELETE FROM product_categories WHERE id = ?").bind(id).run();
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Category could not be deleted." }, { status: 400 });
  }
}
