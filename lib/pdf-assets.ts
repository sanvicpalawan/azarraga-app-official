import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSettings as getCatalogSettings, getFile } from "./catalog-store";
import type { Settings } from "./documents";

/** Resolve bytes directly, so PDF generation never depends on a public URL fetching itself. */
export async function pdfSettings(settings: Settings): Promise<Settings> {
  if (settings.logoDataUrl) return settings;
  try {
    const catalog = await getCatalogSettings();
    if (catalog.logoKey) {
      const file = await getFile(catalog.logoKey);
      if (file) return { ...settings, logoDataUrl: `data:${file.contentType};base64,${Buffer.from(file.body).toString("base64")}` };
    }
  } catch { /* Normalized-only databases may not have the legacy catalog settings. */ }
  const bytes = await readFile(path.join(process.cwd(), "public/azarraga-logo-mark.jpg"));
  return { ...settings, logoDataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}` };
}
