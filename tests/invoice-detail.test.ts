import { afterEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InvoiceDetailPage from "../app/invoices/[id]/page";
import { loadDocument, listPayments } from "../lib/documents";
import { previewDocuments } from "../lib/local-preview";

vi.mock("../lib/documents", () => ({ loadDocument: vi.fn(), listPayments: vi.fn() }));
vi.mock("../components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../components/payment-panel", () => ({ PaymentPanel: () => null }));
vi.mock("../components/share-menu", () => ({ ShareMenu: () => null }));
afterEach(() => vi.clearAllMocks());

test("invoice shows the agreed items, excluding unselected alternatives", async () => {
  const base = previewDocuments()[1]; const section = base.sections[0];
  vi.mocked(loadDocument).mockResolvedValue({ ...base, acceptedSectionId: "chosen", sections: [section,
    { ...section, id: "chosen", kind: "alternative", lines: [{ ...section.lines[0], id: "chosen-line", description: "Agreed tempered upgrade" }] },
    { ...section, id: "unused", kind: "alternative", lines: [{ ...section.lines[0], id: "unused-line", description: "Unselected bronze upgrade" }] },
  ] });
  vi.mocked(listPayments).mockResolvedValue([]);
  const html = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: base.id }) }));
  expect(html).toContain("Agreed tempered upgrade");
  expect(html).not.toContain("Unselected bronze upgrade");
});

test("invoice labels the deposit separately from the full balance", async () => {
  const base = previewDocuments()[1];
  vi.mocked(loadDocument).mockResolvedValue({ ...base, total: 7900000, amountPaid: 5530000, depositPercent: 70 });
  vi.mocked(listPayments).mockResolvedValue([]);
  const html = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: base.id }) }));
  expect(html).toMatch(/70% down payment<\/span><strong>₱55,300.00/);
  expect(html).not.toContain("% due now");
});
