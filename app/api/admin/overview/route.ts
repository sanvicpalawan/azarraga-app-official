import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureCatalogDefaults } from "@/lib/catalog-db";

export async function GET() {
  try {
    await ensureCatalogDefaults();
    const db = getRawDb();
    const [quotes, products, categories] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS totalQuotes,
        COALESCE(SUM(grand_total), 0) AS totalRevenue,
        COALESCE(SUM(total_sqft), 0) AS totalSqft
        FROM quotations`).first(),
      db.prepare("SELECT COUNT(*) AS totalProducts FROM products").first(),
      db.prepare("SELECT COUNT(*) AS totalCategories FROM product_categories").first(),
    ]);
    return NextResponse.json({ ...quotes, ...products, ...categories });
  } catch (error) {
    console.error("Unable to load overview", error);
    return NextResponse.json({ error: "Overview is temporarily unavailable." }, { status: 503 });
  }
}
