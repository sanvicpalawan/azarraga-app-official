// Maps a parsed invoice line item to one of the app's existing parametric
// icon templates (components/designer/designer-core.ts) and renders it at
// the item's real parsed dimensions. This is why icons no longer need to be
// static images: the same generator that draws Designer Studio thumbnails
// draws a correct schematic for any future invoice, at any size, forever.

import { TEMPLATES, designToSvg, type Template } from "@/components/designer/designer-core";
import type { ParsedLineItem } from "./invoice-parser";

function guessTemplateKey(item: ParsedLineItem): string {
  const d = item.description.toLowerCase();
  const code = (item.itemCode ?? "").toUpperCase();
  const panelMatch = d.match(/(\d+)\s*panel/);
  const panels = panelMatch ? parseInt(panelMatch[1], 10) : null;

  if (code === "SE" || d.includes("shower enclosure")) return "shower";
  if (code === "SR" || d.includes("railing")) return "rail";
  if (d.includes("storefront")) return "store";
  if (code.startsWith("BD") || d.includes("bi fold") || d.includes("bi-fold")) return "bf4"; // panel count applied separately
  if (d.includes("jalouplus") || d.includes("louver") || d.includes("jalousie")) {
    return panels && panels >= 2 ? "jal2" : "jal";
  }
  if (d.includes("awning")) {
    if (panels === 3) return d.includes("panel") && /1\.\d+\s*x\s*0\.[0-5]/.test(d) ? "a3h" : "a3";
    if (panels && panels >= 4) return "a23";
    return "a1";
  }
  if (d.includes("casement") || d.includes("steel casement")) return panels && panels >= 2 ? "c2" : "c1";
  if (d.includes("tilt")) return "tilt";
  if (d.includes("fixed") && !d.includes("sliding")) return "fx";
  if (d.includes("counter")) return "counter";
  if (code === "D1" && d.includes("double leaf")) return "d2";
  if (code === "D9" || d.includes("single leaf")) return "d1";
  if (d.includes("double swing")) return "d2";
  if (d.includes("door") && d.includes("transom")) return "dt";
  if (d.includes("sliding door") || (item.itemCode?.startsWith("D") && d.includes("sliding"))) {
    if (panels && panels >= 4) return "sd4";
    if (panels === 3) return "sd3";
    return "sd2";
  }
  if (d.includes("sliding")) {
    if (panels === 4) return "s4";
    if (panels === 3) return "s3";
    return "s2";
  }
  return "fx"; // safest generic fallback: a single fixed pane
}

/** Bi-fold panel-count variants the base TEMPLATES list doesn't include yet. */
function bifoldPanels(n: number): Template {
  const syms = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "swingL" : "swingR")) as any;
  return {
    key: `bf${n}`,
    name: `Bi-fold ${n}`,
    cat: "Doors",
    type: "Bi-Fold Doors",
    w: 600 * n,
    h: 2100,
    build: (w, h) =>
      syms.map((s: any, i: number) => ({
        id: `bf-${i}`,
        t: "rect" as const,
        x: Math.round((w * i) / n),
        y: 0,
        w: Math.round(w / n),
        h,
        sym: s,
      })),
  };
}

export function iconDataUrlForItem(item: ParsedLineItem): string {
  let key = guessTemplateKey(item);
  const panelMatch = item.description.toLowerCase().match(/(\d+)\s*panel/);
  const panels = panelMatch ? parseInt(panelMatch[1], 10) : null;

  let tpl: Template | undefined;
  if (key === "bf4" && panels && panels !== 4) {
    tpl = bifoldPanels(panels);
  } else {
    tpl = TEMPLATES.find((t) => t.key === key);
  }
  if (!tpl) tpl = TEMPLATES.find((t) => t.key === "fx")!;

  const widthMm = item.widthM ? Math.round(item.widthM * 1000) : tpl.w;
  const heightMm = item.heightM ? Math.round(item.heightM * 1000) : tpl.h;
  const shapes = tpl.build(widthMm, heightMm);
  const svg = designToSvg({ widthMm, heightMm, shapes }, { px: 400, style: "invoice", dims: false });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
