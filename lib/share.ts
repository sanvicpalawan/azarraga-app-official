import { formatMoney, type CurrencyCode } from "./currency";

/**
 * Sharing quotes/invoices over the apps PH clients actually use.
 * No paid APIs: everything is a deep link or the native share sheet.
 *
 * Priority on mobile:
 *   1. nativeShare()  -> OS share sheet, attaches the PDF itself.
 *                        Works for WhatsApp, Viber, Messenger, Signal, email.
 *   2. shareLinks()   -> per-app buttons (link only, no file attached).
 */

/** Normalize a PH (or international) phone number to digits only, e.g. 639171234567. */
export function normalizePhone(input: string, defaultCountry = "63"): string | null {
  const hasPlus = input.trim().startsWith("+");
  let d = input.replace(/\D/g, "");
  if (!d) return null;

  if (!hasPlus) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.startsWith("0")) d = defaultCountry + d.slice(1);
    else if (d.length === 10 && d.startsWith("9")) d = defaultCountry + d;
  }
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export interface ShareMessageInput {
  type: "quote" | "invoice";
  number: string;
  clientName: string;
  companyName: string;
  total: number; // minor units
  currency: CurrencyCode;
  url: string; // public /share/[token] link
}

export function buildShareMessage(i: ShareMessageInput): string {
  const label = i.type === "quote" ? "Quotation" : "Invoice";
  return [
    `Hi ${i.clientName}, here is your ${label} ${i.number} from ${i.companyName}.`,
    `Total: ${formatMoney(i.total, i.currency)}`,
    `View / download: ${i.url}`,
  ].join("\n");
}

export interface ShareLinks {
  whatsapp: string;
  viber: string;
  messenger: string;
  email: string;
}

export function shareLinks(opts: {
  message: string;
  url: string;
  subject: string;
  phone?: string | null; // raw client phone
  email?: string | null; // client email
}): ShareLinks {
  const text = encodeURIComponent(opts.message);
  const phone = opts.phone ? normalizePhone(opts.phone) : null;

  return {
    // With a number it opens that client's chat; without, WhatsApp asks who to send to.
    whatsapp: phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`,
    viber: `viber://forward?text=${text}`,
    messenger: `fb-messenger://share/?link=${encodeURIComponent(opts.url)}`,
    email: `mailto:${opts.email ?? ""}?subject=${encodeURIComponent(opts.subject)}&body=${text}`,
  };
}

export type NativeShareResult = "shared" | "cancelled" | "unsupported";

/**
 * Opens the phone's share sheet. If a PDF File is given and the browser supports
 * file sharing, the PDF is attached. Signal has no prefilled-message deep link,
 * so this (or copy link) is the only way to reach it.
 */
export async function nativeShare(opts: {
  title: string;
  message: string; // already contains the link
  pdf?: File;
}): Promise<NativeShareResult> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "unsupported";
  }

  const data: ShareData = { title: opts.title, text: opts.message };
  if (opts.pdf && navigator.canShare?.({ files: [opts.pdf] })) {
    data.files = [opts.pdf];
  }

  try {
    await navigator.share(data);
    return "shared";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

/** Fetch the PDF route and wrap it as a File for nativeShare. */
export async function fetchPdfFile(pdfUrl: string, filename: string): Promise<File | undefined> {
  try {
    const res = await fetch(pdfUrl);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return new File([blob], filename, { type: "application/pdf" });
  } catch {
    return undefined;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
