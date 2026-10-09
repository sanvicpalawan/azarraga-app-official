/**
 * Idempotent seed for the quote + invoice system.
 *
 *   pnpm seed:quotes
 *
 * Safe to run any number of times: every statement either inserts only when
 * the row is missing or updates in place. Existing rows are never deleted,
 * and admin-edited values (company name, logo, contact details, terms) are
 * never overwritten by a re-run.
 *
 * What it seeds:
 *   1. company_settings  - one row (id = 1) with Azarraga's real details
 *   2. categories        - the six codePrefix categories, reusing the legacy
 *                          integer-keyed `categories` table and its products
 *   3. option_groups     - Series / Type / Frame / Glass, in that order
 *   4. options           - the vocabulary taken from their real invoices
 *   5. items             - one per existing product, so price memory works
 */
import { sql } from "drizzle-orm";
import { getDrizzle } from "../lib/db/client";
import { companySettings, items, optionGroups, options } from "../lib/db/schema";

// tsx does not read .env.local the way next dev does.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no local env file - DATABASE_URL may already be in the environment */
  }
}

/**
 * The payment block the owner writes by hand on every quotation today.
 * Kept verbatim - this is a hard requirement of the print format.
 */
export const AZARRAGA_PAYMENT_TERMS = `Payment Terms:
70% Down Payment
30% Full Payment upon Installation

Lead Time: 30-45 working days upon receipt of the Down Payment and Final Measurement.

Delivery and labor are included in the quotation.

Azarraga Glass & Aluminum has the right to remove all its property and forfeit the payment to correspond for any expenses incurred during installation as per your requirements, in case of nonpayment after completion. This quotation will serve as a contract once confirmation with deposit is made to us.

Lead Time will commence once the site is ready for installation. Down Payment is non-refundable.`;

/** Six categories -> auto item codes, exactly as the owner labels them. */
const CATEGORY_PREFIXES: Array<{ name: string; prefix: string; sortOrder: number }> = [
  { name: "Windows", prefix: "W", sortOrder: 0 },
  { name: "Doors", prefix: "D", sortOrder: 1 },
  { name: "Louvers", prefix: "AL", sortOrder: 2 },
  { name: "Railings", prefix: "SR", sortOrder: 3 },
  { name: "Shower Enclosures", prefix: "SE", sortOrder: 4 },
  { name: "Bi-Fold", prefix: "BD", sortOrder: 5 },
  { name: "Others", prefix: "OT", sortOrder: 6 },
];

type SeedGroup = {
  name: string;
  joinWithPrevious: boolean;
  labels: string[];
};

/**
 * Four groups, in the order the owner reads them off the spec sheet.
 * Series and Type run together ("798 Series 2 Panel Sliding Window"),
 * everything after joins with a comma.
 */
const OPTION_GROUPS: SeedGroup[] = [
  {
    name: "Series",
    joinWithPrevious: false,
    labels: [
      "798 Series",
      "900 Series",
      "38 Series",
      "75 Series",
      'Jalouplus 4"',
      "868 Series",
      "130 Series",
      "50 Series",
      "60 Series",
      "4-inch",
      "6-inch",
      "Frameless",
    ],
  },
  {
    name: "Type",
    joinWithPrevious: true,
    labels: [
      "2 Panel Sliding Window",
      "2 Panel Sliding + Net",
      "3 Panel Sliding Window",
      "3 Panel Sliding + Net",
      "4 Panel Sliding Window",
      "Awning Window",
      "Fixed Window",
      "Folding Window",
      "Jalousie Window",
      "4-inch Aluminum Jalousie Louver Window",
      "Skylight",
      "Single Leaf ED Door",
      "Double Leaf ED Door",
      "Sliding Door",
      "Casement / Swing Door",
      "Bi-Fold Door",
      "Hanging Door",
      "Roll-Up Door",
      "Fixed-Sliding Counter Window",
      "Slide Up",
      "Glass Railings",
      "Stainless Steel Works",
      "Canopy",
      "ACP Cladding",
      "Sunroom",
      "Mullion",
      "Cabinets",
      "Table Top Glass",
      "Glass Shelves",
    ],
  },
  {
    name: "Frame",
    joinWithPrevious: false,
    labels: [
      "HA Frame",
      "PCW Frame",
      "Tubular Frame",
      "White Frame",
      "Dark Bronze Frame",
      "Analok Frame",
      "Matte Black Frame",
      "No Frame",
    ],
  },
  {
    name: "Glass",
    joinWithPrevious: false,
    labels: [
      "6mm Annealed Clear Glass",
      "6mm Annealed Ref Bronze Glass",
      "6mm Clear Annealed Glass",
      "10mm Annealed Clear Glass",
      "12mm Tempered Clear Glass",
      "Smoked Glass",
      "No Glass",
    ],
  },
];

export interface SeedReport {
  settingsCreated: boolean;
  categoriesTouched: number;
  groupsCreated: number;
  optionsCreated: number;
  itemsCreated: number;
}

export async function seed(): Promise<SeedReport> {
  const db = getDrizzle();
  const report: SeedReport = {
    settingsCreated: false,
    categoriesTouched: 0,
    groupsCreated: 0,
    optionsCreated: 0,
    itemsCreated: 0,
  };

  /* ---------------------------------------------------------------- */
  /* 1. Company settings - insert only when the row is missing.        */
  /* ---------------------------------------------------------------- */
  const existingSettings = await db
    .select({ id: companySettings.id })
    .from(companySettings)
    .where(sql`${companySettings.id} = 1`)
    .limit(1);

  if (existingSettings.length === 0) {
    await db.insert(companySettings).values({
      id: 1,
      name: "Azarraga Glass & Aluminum",
      address: "South National Highway, Brgy San Pedro, Puerto Princesa City, Palawan",
      phone: "0917-894-1339; 0915-535-5233",
      email: "azarragaglass@gmail.com",
      currency: "PHP",
      vatMode: "none",
      quotePrefix: "Q",
      invoicePrefix: "INV",
      numberPattern: "{prefix}{year}-{seq}",
      numberStep: 5,
      numberPad: 0,
      quoteValidityDays: 30,
      defaultDepositPercent: 70,
      defaultLeadTime: "30-45 working days",
      defaultQuoteTerms: AZARRAGA_PAYMENT_TERMS,
    });
    report.settingsCreated = true;
  }

  /* ---------------------------------------------------------------- */
  /* 2. Categories: the legacy table is integer-keyed and already holds */
  /*    Windows/Doors/Others plus 29 products, so it is updated in place. */
  /* ---------------------------------------------------------------- */
  for (const cat of CATEGORY_PREFIXES) {
    const res = await db.execute(sql`
      insert into categories (name, code_prefix, sort_order)
      values (${cat.name}, ${cat.prefix}, ${cat.sortOrder})
      on conflict (name) do update
        set code_prefix = coalesce(categories.code_prefix, excluded.code_prefix)
        where categories.code_prefix is distinct from excluded.code_prefix
    `);
    report.categoriesTouched += res.rows.length ?? 0;
  }

  /* ---------------------------------------------------------------- */
  /* 3 + 4. Option groups and their options.                           */
  /* ---------------------------------------------------------------- */
  const groupRows = await db
    .select({ id: optionGroups.id, name: optionGroups.name })
    .from(optionGroups);
  const optionRows = await db.select({ groupId: options.groupId, label: options.label }).from(options);

  for (const [index, group] of OPTION_GROUPS.entries()) {
    let groupId = groupRows.find((g) => g.name === group.name)?.id ?? null;
    if (!groupId) {
      const inserted = await db
        .insert(optionGroups)
        .values({
          name: group.name,
          categoryId: null, // null = applies to every category
          joinWithPrevious: group.joinWithPrevious,
          sortOrder: index,
        })
        .returning({ id: optionGroups.id });
      groupId = inserted[0]!.id;
      report.groupsCreated += 1;
    }

    const existingLabels = new Set(
      optionRows.filter((o) => o.groupId === groupId).map((o) => o.label),
    );
    const missing = group.labels.filter((label) => !existingLabels.has(label));
    if (missing.length > 0) {
      await db.insert(options).values(
        missing.map((label, i) => ({
          groupId: groupId!,
          label,
          sortOrder: (group.labels.indexOf(label) + i) % 1000,
          priceAdjustment: 0,
          active: true,
        })),
      );
      report.optionsCreated += missing.length;
    }
  }

  /* ---------------------------------------------------------------- */
  /* 5. Items: one per legacy product so price memory has a stable key.*/
  /* ---------------------------------------------------------------- */
  const productRows = await db.execute<{ id: number; name: string }>(sql`
    select id, name from products order by id
  `);
  const existingItems = await db.select({ name: items.name }).from(items);
  const existingNames = new Set(existingItems.map((i) => i.name));

  const newItems = productRows.rows
    .filter((p) => !existingNames.has(p.name))
    .map((p) => ({
      categoryId: null as string | null, // legacy categories are integer-keyed
      name: p.name,
      unit: "set",
      pricingMode: "per_unit" as const,
      areaUnit: "sqm" as const,
      unitPrice: 0,
      active: true,
    }));

  if (newItems.length > 0) {
    await db.insert(items).values(newItems);
    report.itemsCreated = newItems.length;
  }

  return report;
}

async function main() {
  const report = await seed();
  console.log("seed:quotes");
  console.log(`  company_settings : ${report.settingsCreated ? "created" : "already present"}`);
  console.log(`  categories        : ${report.categoriesTouched} prefix(es) set`);
  console.log(`  option_groups     : ${report.groupsCreated} created`);
  console.log(`  options           : ${report.optionsCreated} created`);
  console.log(`  items             : ${report.itemsCreated} created`);
  console.log("done - re-running is always safe");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
