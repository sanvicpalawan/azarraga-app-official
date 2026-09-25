import { PRESETS, TEMPLATES, designToSvg, type Preset } from "@/components/designer/designer-core";
import type { FinishedProjectItem } from "./catalog-types";

/**
 * Full invoice window & door schedule (W1–W8, D1, D9).
 * W7 and W8 are not in the designer presets yet — their specs below are
 * placeholders and should be verified against the invoice.
 */
export const SCHEDULE: Preset[] = [
  ...PRESETS,
  { code: "W7", name: "3 Panel Sliding Window", tpl: "s3", section: "Windows", type: "Sliding Windows", series: "798 Series", w: 1800, h: 1200, desc: "3 Panel 798 Sliding Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.80 x 1.20 (verify against invoice)" },
  { code: "W8", name: "Fixed Window", tpl: "fx", section: "Windows", type: "Fixed Windows", series: "", w: 1200, h: 1200, desc: "Fixed Window with 1 x 3 Tubular Frame, HA, 6mm Annealed Clear Glass, 1.20 x 1.20 (verify against invoice)" },
];

const ORDER = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "D1", "D9"];

export function elevationDataUrl(p: Preset): string {
  const tpl = TEMPLATES.find((t) => t.key === p.tpl) ?? TEMPLATES[0];
  const svg = designToSvg({ widthMm: p.w, heightMm: p.h, shapes: tpl.build(p.w, p.h) }, { px: 600, style: "invoice", dims: true, bg: "#ffffff" });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const toFt = (mm: number) => Math.round((mm / 304.8) * 100) / 100;

/** Build items for the given codes (default: all 10), ordered W1–W8, D1, D9. */
export function scheduleItems(codes: string[] = ORDER): FinishedProjectItem[] {
  const want = new Set(codes.map((c) => c.toUpperCase()));
  return ORDER.filter((c) => want.has(c)).map((code) => {
    const p = SCHEDULE.find((s) => s.code === code)!;
    return {
      id: `sched-${code}-${Date.now().toString(36)}`,
      name: `${code} – ${p.name}`,
      category: p.section,
      widthFt: toFt(p.w),
      heightFt: toFt(p.h),
      quantity: 1,
      rate: 0,
      total: 0,
      series: p.series || undefined,
      glass: p.section === "Doors" ? "10mm Annealed Clear" : "6mm Annealed Clear",
      color: "HA",
      description: p.desc,
      imageDataUrl: elevationDataUrl(p),
    };
  });
}

/** Find schedule codes (W1–W8, D1, D9) mentioned in OCR text. */
export function detectCodes(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.toUpperCase().matchAll(/\b(W[1-8]|D1|D9)\b/g)) found.add(m[1]);
  return [...found];
}
