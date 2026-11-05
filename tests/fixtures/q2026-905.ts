import type { Design, Sym } from "../../components/designer/designer-core";
import type { DocumentDraft } from "../../lib/documents";

/** Transcribed from the owner's two supplied Q2026-905 screenshots. No pricing formula is inferred. */
export const referenceItems = [
  {code:"W1",description:"Fixed Windows on 1-3/4 x 3 Tubular Frame, Light Wengue, 6mm Annealed Clear Glass, 2.50 x 2.20",w:2500,h:2200,qty:2,rate:20050,syms:["F","F","F"]},
  {code:"W2",description:"Fixed Windows on 1-3/4 x 3 Tubular Frame, Light Wengue, 6mm Annealed Clear Glass, 0.85 x 2.10",w:850,h:2100,qty:1,rate:7110,syms:["F"]},
  {code:"W3",description:"38 Series Casement Window, Light Wengue, 6mm Annealed Clear Glass, 1.00 x 1.01",w:1000,h:1010,qty:2,rate:5120,syms:["swingL","swingR"]},
  {code:"W4",description:"38 Series Casement Window, Light Wengue, 6mm Annealed Clear Glass, 2.00 x 1.01",w:2000,h:1010,qty:1,rate:10250,syms:["swingL","F","swingR"]},
  {code:"W5",description:"38 Series Awning Window, Light Wengue, 6mm Annealed Clear Glass, 0.70 x 0.40",w:700,h:400,qty:1,rate:2080,syms:["awning"]},
  {code:"W6",description:"38 Series Awning Window, Light Wengue, 6mm Annealed Clear Glass, 1.50 x 0.40",w:1500,h:400,qty:2,rate:5660,syms:["awning","F","awning"]},
  {code:"W7",description:"900 Series Sliding Window, Light Wengue Frame, 6mm Annealed Clear Glass, 1.60 x 0.75",w:1600,h:750,qty:1,rate:6850,syms:["R","L"]},
  {code:"W8",description:"900 Series Sliding Window, Light Wengue Frame, 6mm Annealed Clear Glass, 1.20 x 1.01",w:1200,h:1010,qty:1,rate:5380,syms:["R","L"]},
  {code:"D1",description:"900 Series Sliding Door Light Wengue Frame, 6mm Annealed Clear Glass, 4.85 x 2.10",w:4850,h:2100,qty:1,rate:43840,syms:["F","F","L","R","F","F"]},
  {code:"D2",description:"900 Series Sliding Door Light Wengue Frame, 6mm Annealed Clear Glass, 2.50 x 2.10",w:2500,h:2100,qty:3,rate:23500,syms:["F","L","R","F"]},
] as const;

export function referenceDesign(item:typeof referenceItems[number]):Design {
  return {id:`reference-${item.code}`,code:item.code,name:item.code,description:item.description,widthMm:item.w,heightMm:item.h,updatedAt:"2026-11-05T00:00:00.000Z",unit:"m",section:item.code.startsWith("D")?"Doors":"Windows",
    shapes:item.syms.map((sym,i)=>({id:`${item.code}-${i}`,t:"rect",x:i*item.w/item.syms.length,y:0,w:item.w/item.syms.length,h:item.h,sym:sym as Sym}))};
}

export function referenceDraft():DocumentDraft {
  return {client:{name:"Reference Q2026-905"},currency:"PHP",vatMode:"none",discountPercent:0,extraCharges:[{label:"Delivery and Installation",amount:1000000}],depositPercent:70,leadTime:"15-30 working days",terms:"70% Down Payment. 30% Full Payment upon Installation.\nLead Time: 15-30 working days upon receipt of the Down Payment and Final Measurement. Delivery and labor are included in the quotation.\nAzarraga Glass & Aluminum has the right to remove all its property and forfeit the payment to correspond for any expenses incurred during installation as per your requirements, in case of nonpayment after completion. This quotation will serve as a contract once confirmation with deposit is made to us.\nLead Time will commence once the site is ready for installation. Down Payment is non-refundable.",
    sections:[{lines:referenceItems.map(item=>({code:item.code,description:item.description,widthMm:item.w,heightMm:item.h,quantity:item.qty,unit:"set",unitPrice:item.rate*100,designJson:referenceDesign(item) as unknown as Record<string,unknown>}))}]};
}
