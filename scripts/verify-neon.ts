/**
 * End-to-end verification of the Neon Postgres integration.
 *
 * Product photos and the company logo are stored inside Neon Postgres itself,
 * so DATABASE_URL is the only thing needed — there is no object-storage
 * provider to configure.
 *
 * Required environment variables:
 *   DATABASE_URL            Neon Postgres connection string
 *
 * Usage:
 *   pnpm verify:neon
 */
import { getDb, readySchema } from "../lib/db";
import {
  addMedia,
  addProduct,
  deleteMedia,
  deleteProduct,
  getCatalogSnapshot,
  getFile,
  listMedia,
  listQuotations,
  removeFile,
  saveFile,
  saveQuotation,
} from "../lib/catalog-store";

type Check = { name: string; ok: boolean; warn: boolean; detail: string };
const checks: Check[] = [];

/** 1x1 transparent PNG used to exercise image storage and the library. */
const PIXEL_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
).buffer as ArrayBuffer;

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
  const required = ["DATABASE_URL"];
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

  console.log("verify:neon — live Neon Postgres checks");

  console.log("\n1. Postgres connection");
  const db = getDb();
  const versionRows = await db.query("select version() as version");
  const version = String((versionRows[0] as { version: string }).version ?? "");
  report(
    "Connected to Neon Postgres",
    version.length > 0,
    version.split(" ")[1] ?? "connected",
  );

  console.log("\n2. Schema + clean catalog");
  const { seeded } = await readySchema();
  report(
    "Schema initialized",
    true,
    seeded ? "created company settings and empty product catalog" : "already present",
  );
  const snapshot = await getCatalogSnapshot();
  report(
    "Categories available",
    snapshot.categories.length >= 3,
    `${snapshot.categories.length} found (expected 3)`,
  );
  report("Company settings available", !!snapshot.settings.companyName, snapshot.settings.companyName);
  report("Catalog readable", Array.isArray(snapshot.products), `${snapshot.products.length} existing products`);

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
  const firstItem = {
    productName: created.name,
    width: 1.2,
    height: 1.2,
    quantity: 2,
    sqft: 10,
    rate: 45,
    pricingMethod: "sqft" as const,
    sectionCompany: "Azarraga Glass & Aluminum",
    sectionType: "Windows",
    glass: "6mm Annealed",
    color: "White",
    lock: "Standard Crescent",
    location: "",
    description: "Temporary quotation created by pnpm verify:neon.",
    total: 450,
  };
  const secondItem = {
    ...firstItem,
    productName: "Verification door",
    imageUrl: "/test-door.png",
    width: 2,
    height: 3,
    quantity: 1,
    sqft: 6,
    rate: 550,
    pricingMethod: "unit" as const,
    total: 550,
  };
  const saved = await saveQuotation({
    quotationNumber,
    customerName: "Verify Customer",
    projectName: "Verify Project",
    projectAddress: "Verify Street, Palawan",
    subtotal: 1000,
    discount: 100,
    grandTotal: 900,
    totalSqft: 16,
    item: firstItem,
    items: [firstItem, secondItem],
  });
  const quotations = await listQuotations();
  const readBack = quotations.find(
    (quotation) => quotation.quotationNumber === quotationNumber,
  );
  report(
    "Quotation insert/read-back",
    readBack?.id === saved.id &&
      readBack.grandTotal === 900 &&
      readBack.customerName === "Verify Customer" &&
      readBack.items?.length === 2 &&
      readBack.items[1].rate === 550 &&
      readBack.items[1].imageUrl === "/test-door.png",
    `id ${saved.id}, number ${quotationNumber}`,
  );
  await db.query("delete from quotations where quotation_number = $1", [
    quotationNumber,
  ]);
  report("Quotation test-row cleanup", true, `${quotationNumber} deleted`);

  console.log("\n5. File storage (images live inside Neon Postgres)");
  const content = `azarraga verify:neon at ${new Date().toISOString()}`;
  const fileKey = await saveFile(
    "azarraga-verify",
    "txt",
    toArrayBuffer(content),
    "text/plain",
  );
  report("File write", true, fileKey);
  const stored = await getFile(fileKey);
  const storedText = stored ? new TextDecoder().decode(stored.body) : null;
  report(
    "File read-back",
    storedText === content,
    storedText === content
      ? `content matches (${stored?.contentType ?? "unknown type"})`
      : "content mismatch or row missing",
  );

  console.log("\n6. Image library");
  const asset = await addMedia({
    filename: "verify.png",
    contentType: "image/png",
    sizeBytes: PIXEL_PNG.byteLength,
    body: PIXEL_PNG,
  });
  report("Library upload", asset.id > 0, `id ${asset.id}, key ${asset.key}`);
  const libraryList = await listMedia();
  report(
    "Library listing",
    libraryList.some((item) => item.id === asset.id),
    `${libraryList.length} image(s) stored`,
  );
  const bytes = await getFile(asset.key);
  report(
    "Library image bytes",
    bytes?.body.byteLength === PIXEL_PNG.byteLength,
    bytes
      ? `${bytes.body.byteLength} bytes, ${bytes.contentType}`
      : "image bytes missing",
  );
  await deleteMedia(asset.id);
  await removeFile(fileKey);
  report("Library delete", (await listMedia()).some((item) => item.id === asset.id) === false, `id ${asset.id} removed`);
  report("File delete", (await getFile(fileKey)) === undefined, `${fileKey} removed`);

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
