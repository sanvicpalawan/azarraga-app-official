/**
 * Archive untouched sample products previously seeded into Neon. Real products,
 * modified samples, historical quotations and imported invoices are preserved.
 * Usage: DATABASE_URL=... node --import tsx scripts/archive-legacy-products.ts [--apply]
 */
import { getDb } from "../lib/db";
import { buildDefaultCatalogData } from "../fixtures/legacy-catalog";

async function main() {
  const db = getDb();
  const legacy = buildDefaultCatalogData("2000-01-01T00:00:00Z").products;
  const rows = await db.query(
    "select id, name, category_id, base_price, description, default_series_id, default_glass_id, image_path, image_key, product_key, design_id, is_custom from products",
  );
  const candidates = rows.filter(row => {
    const old = legacy.find(p => p.id === Number(row.id));
    return old && row.name === old.name && Number(row.category_id) === old.categoryId
      && Number(row.base_price) === old.basePrice && row.description === old.description
      && row.default_series_id === old.defaultSeriesId
      && row.default_glass_id === old.defaultGlassId && row.image_path === old.imagePath
      && row.image_key == null && row.product_key == null && row.design_id == null
      && row.is_custom === false;
  });
  console.log(`Found ${candidates.length} unchanged sample products out of ${rows.length} total products.`);
  if (process.argv[2] !== "--apply") {
    console.log("Dry run only. Run with --apply to archive and remove these exact matches.");
    return;
  }
  await db.query(`create table if not exists archived_sample_products (
    id integer primary key, original_row jsonb not null, archived_at timestamptz not null default now()
  )`);
  let removed = 0;
  for (const row of candidates) {
    // The SQL rechecks every original value before deleting, preventing a
    // concurrent user edit from being removed after the dry-run query.
    const result = await db.query(`with match as (
      select * from products where id = $1 and name = $2 and category_id = $3
      and base_price = $4 and description = $5
      and default_series_id is not distinct from $6::integer
      and default_glass_id is not distinct from $7::integer
      and image_path is not distinct from $8::text
      and image_key is null and product_key is null and design_id is null and is_custom = false
      for update
    ), archive as (
      insert into archived_sample_products (id, original_row)
      select id, to_jsonb(match) from match
      on conflict (id) do nothing returning id
    )
    delete from products where id in (select id from archive) returning id`,
      [row.id, row.name, row.category_id, row.base_price, row.description,
        row.default_series_id, row.default_glass_id, row.image_path]);
    removed += result.length;
  }
  console.log(`Archived and removed ${removed} unchanged sample products. All other records are intact.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
