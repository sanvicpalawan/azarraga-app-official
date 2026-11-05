import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SharePage from "../app/share/[token]/page";

vi.mock("../lib/documents", async () => {
 const { previewDocuments } = await import("../lib/local-preview");
 return { findByShareToken: async () => previewDocuments()[1], getSettings: async () => ({ name: "Azarraga", address: "Palawan", phone: "09170000000" }), markViewed: vi.fn() };
});
vi.mock("../components/share-accept", () => ({ ShareAccept: () => null }));
test("shared quote and invoice rows have labels for stacked mobile cards",async()=>{
 const html=renderToStaticMarkup(await SharePage({params:Promise.resolve({token:"test"})}));
 for(const label of ["Item", "Description", "Drawing", "Quantity", "Unit cost", "Subtotal"]) expect(html).toContain(`data-label="${label}"`);
});
