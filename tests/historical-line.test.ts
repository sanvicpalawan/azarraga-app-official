import { expect, test } from "vitest";
import { historicalLineSeed } from "../lib/historical-line";
import type { FinishedProject, FinishedProjectItem } from "../lib/catalog-types";
import { createDocument, loadDocument, recordPayment, saveDocument } from "../lib/documents";
import { vi, afterEach } from "vitest";
afterEach(()=>vi.unstubAllEnvs());
const project={id:24,fileName:"Turnkey.pdf",invoiceNumber:"Q2026-900",invoiceDate:"2026-11-04",clientName:"Turnkey",notes:"Original source SHA256: abc",status:"historical"} as FinishedProject;
const item={id:"source-a-1",name:"Sliding door",itemCode:"D1",category:"Doors",description:"900 Series Sliding Door",widthM:2.56,heightM:2.11,quantity:4,rate:21040,imageDataUrl:"data:image/png;base64,aA=="} as FinishedProjectItem;
test("reuse carries actual drawing, dimensions and historical price without copying old quantity or customer",()=>{
 const seed=historicalLineSeed(project,item);
 expect(seed).toMatchObject({widthMm:2560,heightMm:2110,unitPrice:2104000,quantity:1,codePrefix:"D",description:item.description});
 expect(seed.designJson).toMatchObject({previewPng:item.imageDataUrl,sourceFile:"Turnkey.pdf",sourceItemCode:"D1",sourceProjectId:24,sourceInvoiceNumber:"Q2026-900"});
 expect(seed).not.toHaveProperty("client");expect(seed.designJson).not.toHaveProperty("shapes");
});
test("missing source artwork and dimensions remain absent; owner review flags remain visible",()=>{
 const seed=historicalLineSeed({...project,notes:"OWNER REVIEW REQUIRED: mismatched total"},{...item,widthM:undefined,heightM:undefined,imageDataUrl:undefined});
 expect(seed.widthMm).toBeNull();expect(seed.heightMm).toBeNull();expect(seed.designJson?.previewPng).toBeUndefined();expect(seed.reviewRequired).toBe(true);
});
test("blades and lump sums retain their source unit rather than becoming sets",()=>{
 const seed=historicalLineSeed({...project,notes:`SOURCE_ITEM_UNITS: ${JSON.stringify({[item.id]:"pc"})}`},item);
 expect(seed.unit).toBe("pc");expect(seed.designJson.sourceUnit).toBe("pc");
});
test("changing a reused price edits the new invoice only and recalculates payment status",async()=>{
 vi.stubEnv("DATABASE_URL","");vi.stubEnv("NODE_ENV","development");vi.stubEnv("NEXT_PUBLIC_LOCAL_PREVIEW","");
 const seed=historicalLineSeed(project,item);
 const draft={type:"invoice" as const,client:{name:"New customer"},sections:[{lines:[{description:seed.description,unitPrice:seed.unitPrice,quantity:1,designJson:seed.designJson}]}]};
 const id=await createDocument(draft);expect((await loadDocument(id))?.status).toBe("unpaid");await recordPayment({documentId:id,amount:seed.unitPrice,method:"cash"});
 expect((await loadDocument(id))?.status).toBe("paid");
 await saveDocument(id,{...draft,sections:[{lines:[{...draft.sections[0].lines[0],unitPrice:seed.unitPrice+100000}]}]});
 const updated=(await loadDocument(id))!;
 expect(updated.type).toBe("invoice");expect(updated.status).toBe("partial");expect(updated.amountPaid).toBe(seed.unitPrice);
 expect(updated.sections[0].lines[0].designJson?.historicalUnitPrice).toBe(seed.unitPrice);expect(item.rate).toBe(21040);
});
