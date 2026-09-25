import type { FinishedProjectInput, FinishedProjectItem } from "./catalog-types";
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
// Keep the fake worker in Next's server trace for PDF parsing on Vercel.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";

type Token = { text: string; x: number; y: number };
const value = (s: string) => Number(s.replace(/[^\d.]/g, ""));
const line = (tokens: Token[], y: number, x1: number, x2: number) =>
  tokens.filter(t => Math.abs(t.y-y) < 5 && t.x >= x1 && t.x < x2)
    .sort((a,b) => a.x-b.x).map(t => t.text).join(" ").trim();

async function capture(canvas: Canvas, y: number, before: number, after: number) {
  const scale = 3;
  const top = Math.round(Math.max(before+3,y-31)*scale);
  const bottom = Math.round(Math.min(after-3,y+31)*scale);
  if (bottom <= top) return;
  // PDF elevation column, excluding both vertical table rules.
  const crop = createCanvas(105*scale, bottom-top);
  crop.getContext("2d").drawImage(canvas, 304*scale, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const context = crop.getContext("2d");
  const image = context.getImageData(0,0,crop.width,crop.height);
  const pixels = image.data;
  let ink = 0;
  for (let row=0;row<crop.height;row++) {
    let rowInk=0;
    for (let col=0;col<crop.width;col++) {
      const i=(row*crop.width+col)*4;
      if (pixels[i]<140 && pixels[i+1]<140 && pixels[i+2]<140 && pixels[i+3]>100) rowInk++;
    }
    if (rowInk > crop.width*.78) {
      for (let col=0;col<crop.width;col++) {
        const i=(row*crop.width+col)*4;
        pixels[i]=255;pixels[i+1]=255;pixels[i+2]=255;pixels[i+3]=255;
      }
    } else ink+=rowInk;
  }
  if (ink < 35) return;
  context.putImageData(image,0,0);
  return "data:image/png;base64,"+(await crop.encode("png")).toString("base64");
}

export async function extractInvoice(bytes: Uint8Array, file: Pick<FinishedProjectInput,"fileName"|"fileType"|"fileSize"|"fileData">): Promise<FinishedProjectInput> {
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true });
  const doc = await task.promise;
  const items: FinishedProjectItem[] = [];
  let clientName="", projectAddress="", invoiceNumber="", invoiceDate="", delivery=0;
  const totals: number[] = [];
  let sectionCount = 0;
  try {
    for (let pageNo=1; pageNo<=doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const tokens: Token[] = content.items.filter((t): t is typeof t & {str:string;transform:number[]} => "str" in t && !!t.str.trim())
        .map(t => ({ text:t.str.trim(),x:t.transform[4],y:page.view[3]-t.transform[5] }));
      if (pageNo===1) {
        clientName=line(tokens,95,0,405) || line(tokens,109,0,405);
        projectAddress=clientName===line(tokens,95,0,405) ? line(tokens,109,0,405) : "";
        invoiceDate=line(tokens,95,405,800);
        invoiceNumber=line(tokens,109,405,800).match(/Q\d{4}-\d+/i)?.[0] || "";
      }
      const headers=tokens.filter(t=>t.text==="ITEM #" && t.x<70).sort((a,b)=>a.y-b.y);
      const rows=tokens.filter(t=>t.x>17 && t.x<51 && /^[A-Z]{1,3}\d{0,2}$/.test(t.text))
        .sort((a,b)=>a.y-b.y);
      const scale=3, viewport=page.getViewport({scale});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvasContext:canvas.getContext("2d") as never,viewport,canvas:canvas as never}).promise;
      for (const [index,row] of rows.entries()) {
        const section=sectionCount+headers.filter(h=>h.y<row.y).length || 1;
        const description=tokens.filter(t=>Math.abs(t.y-row.y)<19 && t.x>=54 && t.x<300)
          .sort((a,b)=>a.y-b.y||a.x-b.x).map(t=>t.text).join(" ").replace(/\s+/g," ").trim();
        const quantity=value(line(tokens,row.y,416,446));
        const rate=value(line(tokens,row.y,490,612));
        const total=value(line(tokens,row.y,612,790));
        if (!description || !quantity || !rate || !total || Math.abs(quantity*rate-total)>.01)
          throw new Error(`Cannot verify item ${row.text} on page ${pageNo}.`);
        const dimensions=description.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*$/i);
        const widthM=dimensions?Number(dimensions[1]):undefined;
        const heightM=dimensions?Number(dimensions[2]):undefined;
        const before=index?(rows[index-1].y+row.y)/2:row.y-35;
        const after=index<rows.length-1?(rows[index+1].y+row.y)/2:row.y+35;
        items.push({
          id:`${pageNo}-${section}-${row.text}-${index}`,itemCode:row.text,quoteOption:section,
          name:description.replace(/,?\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*$/i,""),
          description,category:/door/i.test(description)?"Doors":/window|jalou/i.test(description)?"Windows":"Others",
          widthM,heightM,widthFt:widthM?+(widthM*3.28084).toFixed(4):undefined,
          heightFt:heightM?+(heightM*3.28084).toFixed(4):undefined,
          quantity,rate,total,imageDataUrl:await capture(canvas,row.y,before,after),
        });
      }
      sectionCount+=headers.length;
      for (const t of tokens.filter(t=>/^(?:Sub\s*)?Total$/i.test(t.text)&&t.x>380)) {
        const amount=value(line(tokens,t.y,610,790));
        if (amount) totals.push(amount);
      }
      const deliveryToken=tokens.find(t=>t.text==="Delivery" && t.x>380);
      if (deliveryToken) delivery+=value(line(tokens,deliveryToken.y,610,790));
    }
  } finally { await task.destroy(); }
  if (!items.length || !clientName || !invoiceNumber)
    throw new Error("No readable invoice items found. Please review this PDF manually.");
  const itemSum=items.reduce((s,i)=>s+(i.total||0),0);
  const expected=totals.reduce((s,t)=>s+t,0);
  if (expected && Math.abs(expected-itemSum)>.01)
    throw new Error(`Invoice items total ₱${itemSum}, but the PDF says ₱${expected}.`);
  return {
    projectName:`${clientName} — historical quotation`,clientName,projectAddress,invoiceNumber,invoiceDate,
    totalAmount:itemSum+delivery,fileName:file.fileName,fileType:file.fileType,fileSize:file.fileSize,fileData:file.fileData,
    items,notes:`${totals.length>1?`${totals.length} separate quote options. Do not combine into an order. `:""}${delivery?`Delivery: ₱${delivery.toFixed(2)}. `:""}Historical prices; confirm current pricing before reuse.`,
    status:"historical",
  };
}
