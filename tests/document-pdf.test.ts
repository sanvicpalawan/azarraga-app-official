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
    expect(text).not.toContain("null");
    expect(text).toContain(`${symbol}25,000.00`);
    await pdf.destroy();
  }
});

test("PDF uses saved line drawings for quotes and invoices without inventing missing drawings", async () => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("DATABASE_URL", "");
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(120, 60);
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#0f4c81"; ctx.fillRect(0, 0, 120, 60);
  const previewPng = canvas.toDataURL("image/png");
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const settings = await getSettings();
  for (const base of previewDocuments()) {
    const line = base.sections[0].lines[0];
    const doc = { ...base, sections: [{ ...base.sections[0], lines: [
      { ...line, designJson: { previewPng } },
      { ...line, id: "no-drawing", description: "No saved drawing", designJson: null },
    ] }] };
    const bytes = await renderToBuffer(DocumentPdf({ doc, settings }) as never);
    const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
    const page = await pdf.getPage(1);
    const operators = await page.getOperatorList();
    expect(operators.fnArray.filter(op => op === OPS.paintImageXObject)).toHaveLength(2); // official logo + one saved drawing
    const content = await page.getTextContent();
    const text = content.items.map(item => "str" in item ? item.str : "").join(" ");
    expect(text.replace(/\s/g, "")).toContain("DRAWING");
    expect(text).toContain("No saved drawing");
    await pdf.destroy();
  }
});

test("PDF retains included lines alongside the selected alternative", async () => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("DATABASE_URL", "");
  const base = previewDocuments()[0]; const included = base.sections[0];
  const doc = { ...base, acceptedSectionId: "chosen", sections: [included,
    { ...included, id: "chosen", kind: "alternative" as const, title: "Chosen option", lines: [{ ...included.lines[0], description: "Selected alternative" }] },
    { ...included, id: "other", kind: "alternative" as const, title: "Other option", lines: [{ ...included.lines[0], description: "Unselected alternative" }] },
  ] };
  const bytes = await renderToBuffer(DocumentPdf({ doc, settings: await getSettings() }) as never);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await pdf.getPage(1); const content = await page.getTextContent();
  const text = content.items.map(item => "str" in item ? item.str : "").join(" ");
  expect(text.replace(/\s/g, "")).toContain("2-panelslidingwindow"); expect(text).toContain("Selected alternative");
  expect(text).not.toContain("Unselected alternative"); await pdf.destroy();
});
