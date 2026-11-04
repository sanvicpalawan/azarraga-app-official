import { afterEach, expect, test, vi } from "vitest";
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPdf } from "../components/document-pdf";
import { previewDocuments } from "../lib/local-preview";
import { getSettings } from "../lib/documents";

afterEach(()=>vi.unstubAllEnvs());
test("invoice PDF embeds the official logo when no custom logo is configured", async()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");
  const settings={...await getSettings(),logoDataUrl:null};
  const buffer=await renderToBuffer(DocumentPdf({doc:previewDocuments()[1],settings}) as never);
  expect(buffer.toString("latin1")).toContain("/Subtype /Image");
});

test("PDF fonts preserve peso, dollar and euro symbols and the stored invoice currency",async()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");
  const { getDocument }=await import("pdfjs-dist/legacy/build/pdf.mjs");

  const settings=await getSettings();
  for(const [currency,symbol] of [["PHP","₱"],["USD","$"],["EUR","€"]] as const){
    const doc={...previewDocuments()[1],currency};
    const bytes=await renderToBuffer(DocumentPdf({doc,settings}) as never);
    const pdf=await getDocument({data:new Uint8Array(bytes)}).promise;
    const page=await pdf.getPage(1);const content=await page.getTextContent();
    const text=content.items.map(item=>"str" in item?item.str:"").join(" ").replace(/\s+/g," ");
    expect(text).toContain(`Currency: ${currency}`);
    expect(text).toContain(`${symbol}25,000.00`);
    await pdf.destroy();
  }
});
