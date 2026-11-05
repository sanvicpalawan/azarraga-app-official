import { afterEach, expect, test, vi } from "vitest";
import { snapshotQuoteDrawing, readQuoteDrawing } from "../lib/quote-drawing";
import { quoteDrawingSize } from "../lib/quote-drawing";
import { createDocument, loadDocument, duplicateDocument, convertQuoteToInvoice } from "../lib/documents";
import { referenceDraft, referenceDesign, referenceItems } from "./fixtures/q2026-905";
const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT1sAAAAASUVORK5CYII=";
afterEach(()=>vi.unstubAllEnvs());
test("original raster references retain a known size so resizing cannot silently reuse a mismatched drawing",()=>{
 expect(quoteDrawingSize({previewPng:png,widthMm:2560,heightMm:2110})).toEqual({widthMm:2560,heightMm:2110});
 expect(quoteDrawingSize({previewPng:png})).toBeNull();
 expect(quoteDrawingSize({widthMm:2560,heightMm:2110,sourceProjectId:1})).toBeNull();
});
test("each drawing snapshot stores editable panels, PNG and vector artwork with exact dimensions",()=>{
  const design=referenceDesign(referenceItems[0]);const saved=snapshotQuoteDrawing(design,png);
  expect(readQuoteDrawing(saved.designJson)?.shapes).toHaveLength(3);
  expect(saved.designJson.previewPng).toBe(png);expect(saved.designSvg).toContain("<svg");
  expect(saved).toMatchObject({widthMm:2500,heightMm:2200,description:referenceItems[0].description});
  expect(()=>snapshotQuoteDrawing(design,"https://example.com/changing-image.png")).toThrow();
});
test("the real ten-item reference totals and drawings survive save, duplicate and invoice conversion",async()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("DATABASE_URL","");vi.stubEnv("NEXT_PUBLIC_LOCAL_PREVIEW","");
  const draft=referenceDraft();draft.sections[0].lines.forEach((line,i)=>Object.assign(line,snapshotQuoteDrawing(referenceDesign(referenceItems[i]),png)));
  const id=await createDocument(draft);
  for(const target of [id,await duplicateDocument(id),await convertQuoteToInvoice(id)]){
    const doc=(await loadDocument(target))!;
    expect(doc.subtotal).toBe(20767000);expect(doc.total).toBe(21767000);
    expect(doc.sections[0].lines).toHaveLength(10);
    doc.sections[0].lines.forEach((line,i)=>{
      expect(line.code).toBe(referenceItems[i].code);expect(line.designJson?.previewPng).toBe(png);
      expect(readQuoteDrawing(line.designJson)?.shapes).toHaveLength(referenceItems[i].syms.length);
      expect(line.designSvg).toContain("<svg");
    });
  }
});
