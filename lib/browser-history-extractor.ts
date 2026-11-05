import type { FinishedProjectInput, FinishedProjectItem } from './catalog-types';

export type HistoricalWord = { text: string; x0: number; x1: number; top: number; bottom: number };
export type HistoricalRow = { code: string; description: string; quantity: number; unit: string; rate: number; total: number; widthM?: number; heightM?: number; top: number; bottom: number; drawingLeft: number; drawingRight: number };
const money = (text: string) => { const value=text.replace(/[^\d.\-]/g,''); return /^\d+\.\d{2}$/.test(value) ? Number(value) : undefined; };
export function historicalCell(words: HistoricalWord[], left: number, right: number, top: number, bottom: number): string {
 const rows: HistoricalWord[][]=[];
 for(const word of words.filter(w=>(w.x0+w.x1)/2>=left&&(w.x0+w.x1)/2<right&&(w.top+w.bottom)/2>top&&(w.top+w.bottom)/2<bottom).sort((a,b)=>a.top-b.top||a.x0-b.x0)) {
 const row=rows.find(r=>Math.abs(r[0].top-word.top)<3);if(row)row.push(word);else rows.push([word]);
 }
 return rows.map(row=>row.sort((a,b)=>a.x0-b.x0).map(w=>w.text).join(' ')).join(' ');
}
export function parseHistoricalPage(words: HistoricalWord[], horizontalBorders: number[], shifted: boolean) {
 const shift=shifted?8.04:0;const cols=[16.98,54.06+shift,299.03+shift,412.67+shift,440.89+shift,473.89+shift,557.65+shift,713.2+shift];const items:HistoricalRow[]=[];const errors:string[]=[];
 for(let i=0;i<horizontalBorders.length-1;i++) {
 const top=horizontalBorders[i],bottom=horizontalBorders[i+1];const cells=cols.slice(0,-1).map((x,j)=>historicalCell(words,x,cols[j+1],top,bottom));
 const [code,description,,qty,unit,rateText,totalText]=cells;const rate=money(rateText),total=money(totalText);
 if(rate===undefined||total===undefined||!/^\d+(?:\.\d+)?$/.test(qty))continue;
 const quantity=Number(qty);if(Math.round(quantity*rate*100)!==Math.round(total*100))errors.push(`${code||description}: quantity × rate differs from printed subtotal`);
 const dimensions=[...description.matchAll(/(\d+(?:\.\d+)?)\s*(?:\(L\))?\s*[x×]\s*(\d+(?:\.\d+)?)/gi)];const dim=dimensions.at(-1);
 items.push({code,description,quantity,unit,rate,total,widthM:dim?Number(dim[1]):undefined,heightM:dim?Number(dim[2]):undefined,top,bottom,drawingLeft:cols[2],drawingRight:cols[3]});
 }
 const charges:{label:string;amount:number}[]=[],printed:number[]=[],subtotals:number[]=[];const seen=new Set<number>();
 for(const word of words) {
 if(word.x0<cols[6]||! /\.\d{2}$/.test(word.text)||[...seen].some(y=>Math.abs(y-word.top)<3))continue;
 const line=historicalCell(words,0,792,word.top-2,word.bottom+2);
 if(!/\b(?:Sub\s*Total|Total|Delivery|Crating|Installation cost)\b/i.test(line))continue;
 const amount=money(historicalCell(words,cols[6],792,word.top-2,word.bottom+2));if(amount===undefined)continue;seen.add(word.top);
 if(/\bSub\s*Total\b/i.test(line))subtotals.push(amount);else if(/\bTotal\b/i.test(line)&&!/Crating|Delivery|Installation/i.test(line))printed.push(amount);else charges.push({label:historicalCell(words,0,cols[6]-5,word.top-2,word.bottom+2).replace('₱','').trim(),amount});
 }
 return {items,errors,charges,printed,subtotals};
}
export function reconcileHistoricalTotals(lines:number[],charges:number[],printedTotals:number[]) {const computed=Math.round([...lines,...charges].reduce((a,b)=>a+b,0)*100)/100;const printed=printedTotals.length?Math.round(printedTotals.reduce((a,b)=>a+b,0)*100)/100:undefined;return {computed,printed,reconciled:printed!==undefined&&Math.abs(computed-printed)<.005};}

function dark(data:Uint8ClampedArray,index:number) {return data[index]<100&&data[index+1]<100&&data[index+2]<100&&data[index+3]>100;}
/** Detect source table rules from actual page pixels, at PDF point coordinates. */
export function detectHistoricalBorders(data:Uint8ClampedArray,width:number,height:number,scale:number) {
 const ys:number[]=[];
 for(let y=0;y<height;y++){let count=0;for(let x=Math.round(18*scale);x<Math.min(width,Math.round(712*scale));x++)if(dark(data,(y*width+x)*4))count++;if(count>650*scale)ys.push(y/scale);}
 const borders:number[]=[];for(const y of ys){if(!borders.length||y-borders.at(-1)!>2)borders.push(y);}
 let shiftedScore=0,normalScore=0;
 for(let y=0;y<height;y++){if(dark(data,(y*width+Math.round(62.1*scale))*4))shiftedScore++;if(dark(data,(y*width+Math.round(54.06*scale))*4))normalScore++;}
 return {borders,shifted:shiftedScore>normalScore};
}
function originalCrop(canvas:HTMLCanvasElement,row:HistoricalRow,scale:number):string|undefined {
 const left=Math.round((row.drawingLeft+1.5)*scale),top=Math.round((row.top+1.5)*scale),width=Math.round((row.drawingRight-row.drawingLeft-3)*scale),height=Math.round((row.bottom-row.top-3)*scale);if(width<1||height<1)return;
 const context=canvas.getContext('2d')!;const pixels=context.getImageData(left,top,width,height);let minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(pixels.data[i+3]>0&&Math.min(pixels.data[i],pixels.data[i+1],pixels.data[i+2])<230){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
 if(maxX<0)return;const crop=document.createElement('canvas');crop.width=maxX-minX+1;crop.height=maxY-minY+1;crop.getContext('2d')!.drawImage(canvas,left+minX,top+minY,crop.width,crop.height,0,0,crop.width,crop.height);return crop.toDataURL('image/png');
}
const asDataUrl=(file:File)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});

export function historicalProductFacts(description:string):Pick<FinishedProjectItem,'category'|'series'|'glass'|'color'> {
 const category:FinishedProjectItem['category']=(/canopy|skylight|partition|glass\s*wall|blades|glass\s*supply/i.test(description)||(/\bglass\b/i.test(description)&&!/window|door|awning|sliding|fixed|jalous/i.test(description)))?'Others':/door/i.test(description)?'Doors':/window|glass|awning|sliding|fixed|jalous/i.test(description)?'Windows':'Others';
 const series=description.match(/\b\d{2,4}\s*(?:Series|S\b)/i)?.[0]||description.match(/\bJalouplus\b/i)?.[0]||description.match(/\b(?:798|900|130|38)\b(?=\s+(?:Sliding|Awning))/i)?.[0];
 const glass=description.match(/\b\d+(?:\.\d+)?\s*mm\s+(?:(?:Annealed|Tempered|Laminated|Frosted|Reflective|Clear|Tinted|Bronze|Euro\s*Gr[ae]y|Gr[ae]y|Blue|Green)\s+)*Glass\b/i)?.[0];
 const color=description.match(/\b(?:Wood\s*(?:Grain|Finish)|Powder\s*Coat(?:ed)?(?:\s+(?:White|Black|Brown))?|HA|Analok|Anodized|Champagne)\b/i)?.[0];
 return {category,series,glass,color};
}

export async function extractHistoricalPdf(file:File):Promise<FinishedProjectInput> {
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 // pdfjs ships this executable worker without TypeScript declarations.
 // @ts-expect-error Worker module has no declaration file.
 await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
 const original=await file.arrayBuffer();const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',original))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const doc=await pdfjs.getDocument({data:new Uint8Array(original.slice(0)),useSystemFonts:true,isEvalSupported:false}).promise;
 let firstPageWords:HistoricalWord[]=[]; const items:FinishedProjectItem[]=[],units:Record<string,string>={},errors:string[]=[],textPages:string[]=[],charges:{label:string;amount:number}[]=[],printed:number[]=[],subtotals:number[]=[];
 try {for(let p=1;p<=doc.numPages;p++) {
 const page=await doc.getPage(p);const viewport=page.getViewport({scale:3});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
 await page.render({canvasContext:ctx,viewport,background:'white'}).promise;
 const text=await page.getTextContent();const words:HistoricalWord[]=[];
 for(const entry of text.items){if(!('str' in entry)||!entry.str.trim())continue;const [,,,d,x,y]=entry.transform;const height=entry.height||Math.abs(d)||8;words.push({text:entry.str.trim(),x0:x,x1:x+entry.width,top:page.getViewport({scale:1}).height-y-height*.8,bottom:page.getViewport({scale:1}).height-y+height*.2});}
 if(p===1)firstPageWords=words; textPages.push(historicalCell(words,0,1000,0,1000));
 const image=ctx.getImageData(0,0,canvas.width,canvas.height);const geometry=detectHistoricalBorders(image.data,image.width,image.height,3);const parsed=parseHistoricalPage(words,geometry.borders,geometry.shifted);
 errors.push(...parsed.errors);charges.push(...parsed.charges);printed.push(...parsed.printed);subtotals.push(...parsed.subtotals);
 for(const row of parsed.items){const id=`source-${p}-${items.length+1}`;units[id]=row.unit;items.push({id,name:row.description,description:row.description,itemCode:row.code,...historicalProductFacts(row.description),quantity:row.quantity,rate:row.rate,total:row.total,widthM:row.widthM,heightM:row.heightM,widthFt:row.widthM===undefined?undefined:row.widthM*3.28084,heightFt:row.heightM===undefined?undefined:row.heightM*3.28084,imageDataUrl:originalCrop(canvas,row,3)});}
 canvas.width=0;canvas.height=0;page.cleanup();
 }}finally{await doc.destroy();}
 if(!items.length)throw new Error('No source table rows found. Keep the original PDF and review its layout manually.');
 const full=textPages.join('\n');const header=full.split(/ITEM\s*#/i)[0];const dateMatch=header.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i);const number=header.match(/(?:Qotation|Quotation|Invoice)\s*#\s*(\S+)/i)?.[1]||'';
 // Source header is read in geometric lines separately from the flattened invoice body.
 const monthWord=firstPageWords.find(w=>/^(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(w.text)); const customerLine=monthWord?historicalCell(firstPageWords,0,monthWord.x0-2,monthWord.top-2,monthWord.bottom+2):''; const projectAddress=monthWord?historicalCell(firstPageWords,0,440,monthWord.bottom+2,monthWord.bottom+22).replace(/(?:Qotation|Quotation|Invoice).*$/i,'').trim():'';
 const date=dateMatch?new Date(dateMatch[0]):undefined;const invoiceDate=date&&!Number.isNaN(date.valueOf())?`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:'';
 const reconciliation=reconcileHistoricalTotals(items.map(i=>i.total||0),charges.map(c=>c.amount),printed);if(!reconciliation.reconciled)errors.push(`Printed total ${reconciliation.printed??'not identified'} differs from computed ${reconciliation.computed}`);
 const lineSum=items.reduce((sum,item)=>sum+(item.total||0),0);if(subtotals.length&&Math.abs(subtotals.reduce((a,b)=>a+b,0)-lineSum)>.005)errors.push('Printed subtotals differ from item sum');
 const clientName=customerLine||header.match(/(?:ATTENTION|CLIENT|CUSTOMER)\s*:?\s*(.*?)(?=\s+(?:Quotation|Qotation|Invoice|January|February|March|April|May|June|July|August|September|October|November|December)|$)/i)?.[1]?.trim()||file.name.replace(/\.pdf$/i,'');
 for(const item of items){item.sourceAccountName=clientName;item.sourceQuotationNumber=number;item.sourceQuoteDate=invoiceDate;}
 return {projectName:clientName,clientName,projectAddress,invoiceNumber:number,invoiceDate,totalAmount:reconciliation.printed??reconciliation.computed,fileName:file.name,fileType:file.type||'application/pdf',fileSize:file.size,fileData:await asDataUrl(file),items,status:'historical',notes:[errors.length?`OWNER REVIEW REQUIRED: ${errors.join('; ')}`:'Verified: item arithmetic and printed grand total reconcile.',`SOURCE_SHA256: ${sha256}`,`SOURCE_ITEM_UNITS: ${JSON.stringify(units)}`,`SOURCE_CHARGES: ${JSON.stringify(charges)}`,`SOURCE_RECONCILIATION: ${JSON.stringify(reconciliation)}`,`SOURCE_TEXT: ${full}`].join('\n')};
}
