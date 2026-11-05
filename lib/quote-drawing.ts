import { designSchema } from "./design-schema";
import { buildDescription, designToSvg, type Design } from "../components/designer/designer-core";

export function readQuoteDrawing(value: unknown): Design | null {
  const result=designSchema.safeParse(value);
  return result.success ? result.data as Design : null;
}

export function quoteDrawingSize(value: unknown): {widthMm:number;heightMm:number} | null {
  if (!value || typeof value !== "object") return null;
  const drawing=value as Record<string,unknown>;
  if (typeof drawing.previewPng !== "string" && !Array.isArray(drawing.shapes)) return null;
  return typeof drawing.widthMm === "number" && drawing.widthMm > 0 && typeof drawing.heightMm === "number" && drawing.heightMm > 0
    ? {widthMm:drawing.widthMm,heightMm:drawing.heightMm} : null;
}

/** One snapshot travels with the quoted item, never a mutable catalog image reference. */
export function snapshotQuoteDrawing(design: Design, previewPng: string) {
  const parsed=designSchema.parse(design) as Design;
  if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(previewPng)||previewPng.length>4_000_000)throw new Error("The drawing image must be a PNG smaller than 3 MB.");
  return {
    designJson:{...parsed,previewPng} as Record<string,unknown>,
    designSvg:designToSvg(parsed,{px:800,style:"invoice",sw:12,tone:parsed.section==="Doors"?"grey":"blue",dims:false}),
    widthMm:parsed.widthMm,heightMm:parsed.heightMm,
    description:parsed.description.trim()||buildDescription(parsed),
  };
}
