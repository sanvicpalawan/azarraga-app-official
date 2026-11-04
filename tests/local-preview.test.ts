import { afterEach, expect, test, vi } from "vitest";
import { isLocalPreview, previewDocuments } from "../lib/local-preview";

afterEach(() => vi.unstubAllEnvs());

test("sample data requires an explicit local development flag and no real database", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_LOCAL_PREVIEW", "1");
  vi.stubEnv("DATABASE_URL", "");
  expect(isLocalPreview()).toBe(true);
  vi.stubEnv("NODE_ENV", "production");
  expect(isLocalPreview()).toBe(false);
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DATABASE_URL", "postgres://configured");
  expect(isLocalPreview()).toBe(false);
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_LOCAL_PREVIEW", "");
  expect(isLocalPreview()).toBe(false);
});

test("quote and invoice previews have complete detail pages with consistent totals", () => {
  const docs = previewDocuments();
  expect(docs.map((doc) => doc.type)).toEqual(["quote", "invoice"]);
  for (const doc of docs) {
    expect(doc.client.name).toBe("Sample Customer");
    expect(doc.sections.flatMap((section) => section.lines).reduce((sum, line) => sum + line.lineTotal, 0)).toBe(doc.total);
  }
});
