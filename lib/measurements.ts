export type MeasurementUnit = "m" | "mm" | "ft-in";
const decimal = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
function inches(value: string): number | null {
 const match = value.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
 if (match) {
  const denominator = Number(match[3]);
  if (!denominator || Number(match[2]) >= denominator) return null;
  return Number(match[1] ?? 0) + Number(match[2]) / denominator;
 }
 return decimal.test(value) ? Number(value) : null;
}
/** Strictly parse a positive dimension to canonical integer millimetres. Bare imperial input is inches. */
export function parseMeasurement(raw: string, unit: MeasurementUnit): number | null {
 const value = raw.trim();
 let mm: number;
 if (unit === "ft-in") {
  const match = value.match(/^(\d+)\s*(?:'|ft)\s*(.*?)\s*(?:"|in)?$/i);
  if (match) {
   const tail = match[2].trim().replace(/(?:"|in)$/i, "").trim();
   const inch = tail ? inches(tail) : 0;
   if (inch === null || inch >= 12) return null;
   mm = (Number(match[1]) * 12 + inch) * 25.4;
  } else {
   const inch = inches(value.replace(/(?:"|in)$/i, "").trim());
   if (inch === null) return null;
   mm = inch * 25.4;
  }
 } else {
  if (!decimal.test(value)) return null;
  mm = Number(value) * (unit === "m" ? 1000 : 1);
 }
 const rounded = Math.round(mm);
 return Number.isSafeInteger(rounded) && rounded > 0 ? rounded : null;
}
export function formatMeasurement(mm: number | null | undefined, unit: MeasurementUnit): string {
 if (mm == null) return "";
 if (unit === "m") return String(mm / 1000);
 if (unit === "mm") return String(mm);
 const feet = Math.floor(mm / 304.8);
 const remainder = (mm / 25.4) - feet * 12;
 return `${feet}' ${Number(remainder.toFixed(5))}\"`;
}
export function validateLineNumbers(quantity: string, rate: string, width: string, height: string, unit: MeasurementUnit, areaRequired: boolean): string | null {
 if (!decimal.test(quantity.trim()) || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) return "Quantity must be a finite number greater than zero.";
 if (!decimal.test(rate.trim()) || !Number.isFinite(Number(rate)) || Number(rate) < 0) return "Rate must be a finite number of zero or more.";
 if ((width.trim() || areaRequired) && parseMeasurement(width, unit) === null) return "Width must be a positive dimension in the selected unit.";
 if ((height.trim() || areaRequired) && parseMeasurement(height, unit) === null) return "Height must be a positive dimension in the selected unit.";
 return null;
}
