/**
 * End-to-end verification of the Neon Postgres + S3-compatible object storage
 * integration.
 *
 * Required environment variables:
 *   DATABASE_URL            Neon Postgres connection string
 *   S3_BUCKET               Object storage bucket (e.g. azarraga-images)
 *   AWS_REGION              Bucket region
 *   AWS_ACCESS_KEY_ID       Object storage access key id
 *   AWS_SECRET_ACCESS_KEY   Object storage secret access key
 *   AWS_ENDPOINT_URL_S3     S3-compatible API endpoint (e.g. Cloudflare R2)
 *
 * Optional:
 *   S3_PUBLIC_BASE_URL      Public base URL of the bucket (e.g.
 *                           https://pub-xxxx.r2.dev) used to check that
 *                           public object URLs are reachable.
 *
 * Usage:
 *   pnpm verify:neon
 */
import { getDb, readySchema } from "../lib/db";
import {
  addProduct,
  deleteProduct,
  getCatalogSnapshot,
  listQuotations,
  saveQuotation,
} from "../lib/catalog-store";
import {
  deleteObject,
  getObject,
  getS3Bucket,
  headBucket,
  publicObjectBaseUrl,
  uploadObject,
} from "../lib/s3";

type Check = { name: string; ok: boolean; warn: boolean; detail: string };
const checks: Check[] = [];

function report(
  name: string,
  ok: boolean,
  detail: string,
  warn = false,
): void {
  checks.push({ name, ok, warn, detail });
  const label = !ok && warn ? "WARN" : ok ? "PASS" : "FAIL";
  console.log(`  [${label}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function requiredEnv(): string[] {
  const required = [
    "DATABASE_URL",
    "S3_BUCKET",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
  ];
  return required.filter((name) => !process.env[name]);
}

function toArrayBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(0) as ArrayBuffer;
}

async function main(): Promise<void> {
  const missing = requiredEnv();
  if (missing.length > 0) {
    console.error(
      `verify:neon: missing required environment variables: ${missing.join(", ")}`,
    );
    console.error(
      "Set them in the environment (e.g. a .env file or Vercel project settings) and re-run.",
    );
    process.exit(1);
  }

  console.log("verify:neon — live Neon Postgres + object storage checks");

  console.log("\n1. Postgres connection");
  const db = getDb();
  const versionRows = await db.query("select version() as version");
  const version = String((versionRows[0] as { version: string }).version ?? "");
  report(
    "Connected to Neon Postgres",
    version.length > 0,
    version.split(" ")[1] ?? "connected",
  );

  console.log("\n2. Schema + catalog seed");
  const { seeded } = await readySchema();
  report(
    "Schema initialized",
    true,
    seeded ? "created and seeded the default catalog" : "already present",
  );
  const snapshot = await getCatalogSnapshot();
  report(
    "Seed: categories",
    snapshot.categories.length === 3,
    `${snapshot.categories.length} found (expected 3)`,
  );
  report(
    "Seed: attributes",
    snapshot.attributes.length === 21,
    `${snapshot.attributes.length} found (expected 21)`,
  );
  report(
    "Seed: products",
    snapshot.products.length === 28,
    `${snapshot.products.length} found (expected 28)`,
  );
  const fourPanel = snapshot.products.find(
    (product) => product.name === "4 Panel Sliding Window",
  );
  report(
    "Seed: four-panel sliding window price",
    fourPanel?.basePrice === 1850,
    fourPanel
      ? `P${fourPanel.basePrice.toFixed(2)} (expected P1850.00)`
      : "product not found",
  );

  console.log("\n3. Product write/read-back round-trip");
  const stamp = Date.now();
  const created = await addProduct({
    name: `Verify Product ${stamp}`,
    categoryId: snapshot.categories[0]?.id ?? 1,
    basePrice: 1234.5,
    description: "Temporary product created by pnpm verify:neon.",
    defaultSeriesId: null,
    defaultGlassId: null,
  });
  const afterCreate = await getCatalogSnapshot();
  report(
    "Product create/read-back",
    afterCreate.products.some((product) => product.id === created.id),
    `id ${created.id} visible after insert`,
  );
  const deleted = await deleteProduct(created.id);
  const afterDelete = await getCatalogSnapshot();
  report(
    "Product delete",
    deleted?.id === created.id &&
      !afterDelete.products.some((product) => product.id === created.id),
    "removed from the catalog",
  );

  console.log("\n4. Quotation write/read-back round-trip");
  const quotationNumber = `VERIFY-${stamp}`;
  const saved = await saveQuotation({
    quotationNumber,
    customerName: "Verify Customer",
    projectName: "Verify Project",
    projectAddress: "Verify Street, Palawan",
    subtotal: 1000,
    discount: 100,
    grandTotal: 900,
    totalSqft: 20,
    item: {
      productName: "4 Panel Sliding Window",
      width: 1.2,
      height: 1.2,
      quantity: 2,
      sqft: 10,
      rate: 450,
      pricingMethod: "sqft",
      sectionCompany: "Azarraga Glass & Aluminum",
      sectionType: "Windows",
      glass: "6mm Annealed",
      color: "White",
      lock: "Standard Crescent",
      location: "",
      description: "Temporary quotation created by pnpm verify:neon.",
      total: 900,
    },
  });
  const listed = await listQuotations();
  const readBack = listed.find(
    (quotation) => quotation.quotationNumber === quotationNumber,
  );
  report(
    "Quotation insert/read-back",
    readBack?.id === saved.id &&
      readBack.grandTotal === 900 &&
      readBack.item.productName === "4 Panel Sliding Window",
    `id ${saved.id}, number ${quotationNumber}`,
  );
  await db.query("delete from quotations where quotation_number = $1", [
    quotationNumber,
  ]);
  report("Quotation test-row cleanup", true, `${quotationNumber} deleted`);

  console.log("\n5. Object storage (S3-compatible)");
  const bucket = getS3Bucket();
  report("Bucket reachable", await headBucket(), `bucket ${bucket}`);
  const key = `azarraga-verify/${crypto.randomUUID()}.txt`;
  const content = `azarraga verify:neon at ${new Date().toISOString()}`;
  await uploadObject(key, toArrayBuffer(content), "text/plain");
  report("Object upload", true, key);
  const fetched = await getObject(key);
  const downloaded = fetched ? new TextDecoder().decode(fetched.body) : null;
  const contentMatches = downloaded === content;
  report(
    "Object download",
    contentMatches,
    contentMatches
      ? `content matches (${fetched?.contentType ?? "unknown type"})`
      : "content mismatch or object missing",
  );
  const publicBase = publicObjectBaseUrl();
  if (publicBase) {
    try {
      const response = await fetch(`${publicBase}/${key}`);
      report(
        "Public object URL",
        response.ok,
        `HTTP ${response.status} for ${publicBase}/${key}`,
        !response.ok,
      );
    } catch (error) {
      report(
        "Public object URL",
        false,
        `request failed: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }
  } else {
    report(
      "Public object URL",
      true,
      "skipped — set S3_PUBLIC_BASE_URL (or AWS_ENDPOINT_URL_S3) to check; the app serves images through /api/products/:id/image either way",
      true,
    );
  }
  await deleteObject(key);
  report("Object delete", (await getObject(key)) === undefined, `${key} removed`);

  const failed = checks.filter((check) => !check.ok && !check.warn);
  const warned = checks.filter((check) => check.warn);
  console.log("");
  if (failed.length > 0) {
    console.error(`verify:neon FAILED — ${failed.length} check(s) failed.`);
    process.exit(1);
  }
  if (warned.length > 0) {
    console.log(`verify:neon PASSED with ${warned.length} warning(s).`);
  } else {
    console.log("verify:neon PASSED — all checks green.");
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(
    "verify:neon aborted:",
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exit(1);
});
