import type { FinishedProject, FinishedProjectItem } from "./catalog-types";

export function historicalLineSeed(project: FinishedProject, item: FinishedProjectItem) {
  const widthMm = item.widthM == null ? null : Math.round(item.widthM * 1000);
  const heightMm = item.heightM == null ? null : Math.round(item.heightM * 1000);
  let unit = "set";
  const sourceUnits = project.notes?.match(/^SOURCE_ITEM_UNITS: (.+)$/m)?.[1];
  if (sourceUnits) { try { unit = JSON.parse(sourceUnits)[item.id] || unit; } catch { /* Older notes need no unit map. */ } }
  return {
    description: item.description || item.name,
    widthMm, heightMm, quantity: 1, unit, currency: "PHP" as const,
    unitPrice: Math.round((item.rate ?? 0) * 100),
    codePrefix: item.category === "Doors" ? "D" : item.category === "Windows" ? "W" : "O",
    reviewRequired: /OWNER REVIEW REQUIRED|REVIEW REQUIRED/.test(project.notes ?? ""),
    designJson: {
      ...(item.imageDataUrl ? { previewPng: item.imageDataUrl, referencePng: item.imageDataUrl } : {}),
      widthMm, heightMm,
      sourceProjectId: project.id, sourceItemId: item.id,
      sourceFile: project.fileName, sourceItemCode: item.itemCode,
      sourceInvoiceNumber: project.invoiceNumber, sourceDate: project.invoiceDate,
      historicalUnitPrice: Math.round((item.rate ?? 0) * 100),
      sourceCurrency: "PHP",
      sourceUnit: unit,
    } as Record<string, unknown>,
  };
}

export type HistoricalLineSeed = ReturnType<typeof historicalLineSeed>;
