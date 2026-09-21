import { getRawDb } from "@/db";

export type AttributeType = "series" | "glass" | "color" | "lock";

const defaultTerms = "70% Down Payment, 30% upon Installation. Lead Time: 30-45 Working Days. Delivery and labor included. Down Payment is non-refundable.";

const defaultAttributes: Record<AttributeType, string[]> = {
  series: ["Series 798", "Series 900", "Series 868", "Series 130", "Series 38", "Series 50", "Series 60", "4-inch", "6-inch", "Low-end", "Middle-end", "Frameless", "Awning / High-end"],
  glass: ["6mm Annealed", "10mm Annealed", "Tempered"],
  color: ["Dark Bronze", "White", "Analok"],
  lock: ["Standard Crescent", "Heavy Duty"],
};

const defaultProducts = [
  ["2 Panel Sliding Window", "Windows", 0, "Sliding window with two operable panels.", "Series 798", "6mm Annealed", null],
  ["3 Panel Sliding Window", "Windows", 0, "Sliding window with three panels.", "Series 798", "6mm Annealed", null],
  ["4 Panel Sliding Window", "Windows", 1850, "Sliding window with four panels.", "Series 798", "6mm Annealed", "/four-panel-window.png"],
  ["2 Panel Sliding + Net", "Windows", 0, "Sliding window with insect screen.", "Series 798", "6mm Annealed", null],
  ["3 Panel Sliding + Net", "Windows", 0, "Three-panel sliding window with insect screen.", "Series 798", "6mm Annealed", null],
  ["Awning Window", "Windows", 0, "Top-hinged aluminum awning window.", "Series 38", "6mm Annealed", null],
  ["Jalousie Window", "Windows", 0, "Adjustable glass-louver ventilation window.", "4-inch", "6mm Annealed", null],
  ["Fixed Window", "Windows", 0, "Fixed aluminum and glass panel.", "Middle-end", "6mm Annealed", null],
  ["Folding Window", "Windows", 0, "Multi-panel folding window.", "Series 900", "6mm Annealed", null],
  ["Bi-Fold Door", "Doors", 0, "Folding aluminum and glass door.", "Series 900", "6mm Annealed", null],
  ["Sliding Door", "Doors", 0, "Aluminum framed sliding door.", "Series 900", "6mm Annealed", null],
  ["Casement / Swing Door", "Doors", 0, "Hinged aluminum and glass door.", "Series 50", "6mm Annealed", null],
  ["Roll-Up Door", "Doors", 0, "Heavy-duty roll-up door assembly.", null, null, null],
  ["Hanging Door", "Doors", 0, "Top-hung sliding door.", "Series 900", "10mm Annealed", null],
  ["Double Leaf ED Door", "Doors", 0, "10mm annealed glass, standard size 1.65m × 2.10m.", null, "10mm Annealed", null],
  ["Single Leaf ED Door", "Doors", 0, "10mm annealed glass, standard size 0.90m × 2.10m.", null, "10mm Annealed", null],
  ["Skylight", "Others", 0, "Custom aluminum and glass skylight.", null, "Tempered", null],
  ["Glass Railings", "Others", 0, "Custom glass railing system.", null, "Tempered", null],
  ["Sunroom", "Others", 0, "Custom glazed sunroom enclosure.", null, "Tempered", null],
  ["Stainless Steel Works", "Others", 0, "Custom stainless steel fabrication.", null, null, null],
  ["ACP Cladding", "Others", 0, "Aluminum composite panel cladding.", null, null, null],
  ["Mullion", "Others", 0, "Structural aluminum mullion assembly.", null, "6mm Annealed", null],
  ["Glass Shelves", "Others", 0, "Made-to-measure glass shelves.", null, "Tempered", null],
  ["Table Top Glass", "Others", 0, "Custom cut table top glass.", null, "Tempered", null],
  ["Cabinets", "Others", 0, "Aluminum and glass cabinet system.", null, "6mm Annealed", null],
  ["Canopy", "Others", 0, "Aluminum and glass canopy.", null, "Tempered", null],
  ["Slide Up", "Others", 0, "Vertical slide-up service window.", "Series 798", "6mm Annealed", null],
  ["Fixed-Sliding Counter Window", "Others", 0, "Combination fixed and sliding counter window.", "Series 798", "6mm Annealed", null],
] as const;

export async function ensureCatalogDefaults() {
  const db = getRawDb();
  const setting = await db.prepare("SELECT id FROM global_settings WHERE id = 1").first();
  if (!setting) {
    await db.prepare(`INSERT INTO global_settings
      (id, company_name, address, contact_numbers, email, tin, bank_account_name, bank_account_number, bank_name, bank_branch, terms_conditions, pdf_header)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("Azarraga Glass & Aluminum", "Palawan, Philippines", "0945-1308277 / 0999-7057770", "", "", "Azarraga Glass & Aluminum", "", "", "", defaultTerms, "AZARRAGA GLASS & ALUMINUM — QUOTATION")
      .run();
  }

  const categoryCount = await db.prepare("SELECT COUNT(*) AS count FROM product_categories").first<{ count: number }>();
  if (!categoryCount?.count) {
    await db.batch(["Windows", "Doors", "Others"].map((name, index) =>
      db.prepare("INSERT OR IGNORE INTO product_categories (name, sort_order) VALUES (?, ?)").bind(name, index)
    ));
  }

  const attributeCount = await db.prepare("SELECT COUNT(*) AS count FROM product_attributes").first<{ count: number }>();
  if (!attributeCount?.count) {
    const statements: D1PreparedStatement[] = [];
    for (const [type, names] of Object.entries(defaultAttributes)) {
      names.forEach((name, index) => statements.push(
        db.prepare("INSERT OR IGNORE INTO product_attributes (type, name, sort_order) VALUES (?, ?, ?)").bind(type, name, index)
      ));
    }
    await db.batch(statements);
  }

  const productCount = await db.prepare("SELECT COUNT(*) AS count FROM products").first<{ count: number }>();
  if (!productCount?.count) {
    const statements = defaultProducts.map(([name, category, price, description, series, glass, imagePath]) =>
      db.prepare(`INSERT OR IGNORE INTO products
        (name, category_id, base_price, description, default_series_id, default_glass_id, image_path)
        VALUES (?, (SELECT id FROM product_categories WHERE name = ?), ?, ?,
          (SELECT id FROM product_attributes WHERE type = 'series' AND name = ?),
          (SELECT id FROM product_attributes WHERE type = 'glass' AND name = ?), ?)`)
        .bind(name, category, price, description, series, glass, imagePath)
    );
    await db.batch(statements);
  }
}

export function parseId(value: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error("Invalid ID");
  return id;
}

export function productImageUrl(id: number, imageKey: string | null, imagePath: string | null) {
  if (imageKey) return `/api/products/${id}/image`;
  return imagePath || null;
}
