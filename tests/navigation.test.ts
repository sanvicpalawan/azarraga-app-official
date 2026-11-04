import { expect, test } from "vitest";
import { catalogView, ownerSection, OWNER_NAVIGATION } from "../lib/navigation";

test("owner can reach designs, products and past jobs directly", () => {
  for (const item of OWNER_NAVIGATION.filter((item) => item.href.startsWith("/catalog"))) {
    const url = new URL(item.href, "http://preview.local");
    expect(ownerSection(url.pathname, catalogView(url.searchParams.get("view")))).toBe(item.id);
  }
});

test("quote and invoice details retain their section", () => {
  expect(ownerSection("/quotes/preview-quote")).toBe("quotes");
  expect(ownerSection("/quotes/new")).toBe("quotes");
  expect(ownerSection("/invoices/preview-invoice")).toBe("invoices");
  expect(ownerSection("/admin/settings")).toBe("settings");
});

test("unknown catalog views fall back to the existing product chooser", () => {
  expect(catalogView(null)).toBe("catalog");
  expect(catalogView("configure")).toBe("catalog");
  expect(catalogView("studio")).toBe("studio");
});
