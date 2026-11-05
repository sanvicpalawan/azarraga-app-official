import { expect, test } from "vitest";
import { findSourceDrawings } from "../lib/studio-drawings";
import type { FinishedProject } from "../lib/catalog-types";
const sources=[{id:1,fileName:"Turnkey.pdf",invoiceNumber:"Q2026-900",clientName:"Turnkey",items:[{id:"D1",name:"900 Series door",category:"Doors",imageDataUrl:"data:image/png;base64,aA=="},{id:"W1",name:"No source drawing",category:"Windows"}]},{id:2,fileName:"Turnkey_130S.pdf",invoiceNumber:"Q2026-900",items:[{id:"D1",name:"130 Series door",category:"Doors",imageDataUrl:"data:image/png;base64,YQ=="}]}] as FinishedProject[];
test("only actual saved drawings are offered; same-number source variants stay distinct",()=>{
 expect(findSourceDrawings(sources,"","All").map(entry=>entry.project.id)).toEqual([1,2]);
});
test("drawing search finds a source file or specification without returning unrelated images",()=>{
 expect(findSourceDrawings(sources,"130s","All")).toHaveLength(1);
 expect(findSourceDrawings(sources,"900","Windows")).toHaveLength(0);
});
