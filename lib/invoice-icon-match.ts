// Maps a parsed invoice line item to one of the app's parametric icon
// templates. The template guessing, sizing and SVG generation live in
// elevation-icon.ts so both the import pipeline and the printable quotation
// share one implementation; only the encoding differs, since this path runs in
// Node and the quotation renders in the browser.

import { elevationSvg, svgDataUrl, type ElevationSubject } from "./elevation-icon";
import type { ParsedLineItem } from "./invoice-parser";

export { guessTemplateKey, elevationSvg } from "./elevation-icon";

export function iconDataUrlForItem(item: ParsedLineItem): string {
  const subject: ElevationSubject = {
    description: item.description,
    itemCode: item.itemCode,
    widthM: item.widthM,
    heightM: item.heightM,
  };
  return svgDataUrl(elevationSvg(subject));
}
