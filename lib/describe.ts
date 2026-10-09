/**
 * Builds line descriptions the way Azarraga writes them by hand today:
 *   "798 Series 2 Panel Sliding Window, HA Frame, 6mm Annealed Ref Bronze Glass, 1.50 x 2.10"
 * from the option dropdowns + the size. The user can still edit the text.
 */

export interface DescriptionPart {
  label: string;
  joinWithPrevious?: boolean; // join with a space instead of ", "
}

export interface SizeInput {
  widthMm?: number | null;
  heightMm?: number | null;
  lengthMm?: number | null;
}

/** 1500 -> "1.50", 3345 -> "3.345", 10700 -> "10.70". Min 2 decimals, max 3. */
export function formatMeters(mm: number): string {
  const m = mm / 1000;
  const three = m.toFixed(3);
  return three.endsWith("0") ? m.toFixed(2) : three;
}

/** "1.50" or "1,5" or "3.345" -> millimetres. Returns null if not a number. */
export function parseMetersToMm(input: string): number | null {
  const n = parseFloat(input.replace(",", ".").trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

export function formatSize(size: SizeInput): string | null {
  if (size.lengthMm) return `${formatMeters(size.lengthMm)} LM`;
  if (size.widthMm && size.heightMm) {
    return `${formatMeters(size.widthMm)} x ${formatMeters(size.heightMm)}`;
  }
  return null;
}

export function composeDescription(parts: DescriptionPart[], size: SizeInput = {}): string {
  let out = "";
  parts
    .filter((p) => p.label.trim())
    .forEach((p, i) => {
      if (i === 0) out = p.label.trim();
      else out += (p.joinWithPrevious ? " " : ", ") + p.label.trim();
    });

  const sizeText = formatSize(size);
  if (sizeText) out = out ? `${out}, ${sizeText}` : sizeText;
  return out;
}

/** "1 set", "2 sets". */
export function formatQuantity(quantity: number, unit: string): string {
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
  return `${q} ${quantity === 1 ? unit : `${unit}s`}`;
}

/** Stable key for price memory: same options in any click order = same key. */
export function makeSpecKey(optionIds: string[], itemId?: string | null): string {
  return [itemId ?? "", ...[...optionIds].sort()].join("|");
}

/** Next item code for a category prefix: ["W1","W2"] + "W" -> "W3". */
export function nextItemCode(prefix: string, existingCodes: string[]): string {
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  const max = existingCodes.reduce((m, c) => {
    const hit = re.exec(c.trim());
    return hit ? Math.max(m, parseInt(hit[1], 10)) : m;
  }, 0);
  return `${prefix}${max + 1}`;
}

/* ------------------------------------------------------------------ */
/* Document numbering: "{prefix}{year}-{seq}" -> Q2026-645             */
/* ------------------------------------------------------------------ */

export function nextSequence(last: number, step = 5): number {
  return last + Math.max(step, 1);
}

export function formatDocumentNumber(opts: {
  pattern?: string;
  prefix: string;
  year: number;
  seq: number;
  pad?: number;
  revision?: number;
}): string {
  const pattern = opts.pattern ?? "{prefix}{year}-{seq}";
  const seq = String(opts.seq).padStart(opts.pad ?? 0, "0");
  const base = pattern
    .replace("{prefix}", opts.prefix)
    .replace("{year}", String(opts.year))
    .replace("{seq}", seq);
  return opts.revision && opts.revision > 0 ? `${base}-R${opts.revision}` : base;
}
