import { NextResponse } from "next/server";
import { ensureCatalogDefaults, productImageUrl } from "@/lib/catalog-db";
import { getRawDb } from "@/db";

export async function GET() {
  try {
    await ensureCatalogDefaults();
    const db = getRawDb();
    const [settings, categories, products, attributes] = await Promise.all([
      db.prepare(`SELECT id, company_name AS companyName, logo_key AS logoKey, address,
        contact_numbers AS contactNumbers, email, tin, bank_account_name AS bankAccountName,
        bank_account_number AS bankAccountNumber, bank_name AS bankName, bank_branch AS bankBranch,
        terms_conditions AS termsConditions, pdf_header AS pdfHeader, updated_at AS updatedAt
        FROM global_settings WHERE id = 1`).first(),
      db.prepare("SELECT id, name, sort_order AS sortOrder FROM product_categories ORDER BY sort_order, name").all(),
      db.prepare(`SELECT p.id, p.name, p.category_id AS categoryId, c.name AS categoryName,
        p.base_price AS basePrice, p.description, p.default_series_id AS defaultSeriesId,
        p.default_glass_id AS defaultGlassId, p.image_key AS imageKey, p.image_path AS imagePath,
        s.name AS defaultSeries, g.name AS defaultGlass, p.updated_at AS updatedAt
        FROM products p
        JOIN product_categories c ON c.id = p.category_id
        LEFT JOIN product_attributes s ON s.id = p.default_series_id
        LEFT JOIN product_attributes g ON g.id = p.default_glass_id
        ORDER BY c.sort_order, p.name`).all(),
      db.prepare("SELECT id, type, name, sort_order AS sortOrder FROM product_attributes ORDER BY type, sort_order, name").all(),
    ]);

    const productRows = (products.results as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      imageUrl: productImageUrl(row.id as number, row.imageKey as string | null, row.imagePath as string | null),
    }));

    return NextResponse.json({
      settings,
      categories: categories.results,
      products: productRows,
      attributes: attributes.results,
    });
  } catch (error) {
    console.error("Unable to load catalog", error);
    return NextResponse.json({ error: "The product catalog is temporarily unavailable." }, { status: 503 });
  }
}
