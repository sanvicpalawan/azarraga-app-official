"use client";

import { useState } from "react";
import { Share2, Link2, Check, Download, MessageCircle } from "lucide-react";
import { buildShareMessage, shareLinks, copyToClipboard, nativeShare } from "@/lib/share";
import { formatMoney, type CurrencyCode } from "@/lib/currency";

/**
 * The send menu. Native share sheet first (it can attach the PDF), then
 * one-tap buttons for the apps PH clients actually use.
 */
export function ShareMenu({
  shareUrl,
  number,
  clientName,
  clientPhone,
  clientEmail,
  total,
  currency,
  type,
}: {
  shareUrl: string;
  number: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  total: number;
  currency: CurrencyCode;
  type: "quote" | "invoice";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const absolute =
    typeof window !== "undefined"
      ? `${window.location.origin}${shareUrl}`
      : shareUrl;

  const message = buildShareMessage({
    type,
    number,
    clientName,
    companyName: "Azarraga Glass & Aluminum",
    total,
    currency,
    url: absolute,
  });

  const subject =
    type === "quote" ? `Quotation ${number}` : `Invoice ${number}`;
  const links = shareLinks({
    message,
    url: absolute,
    subject,
    phone: clientPhone,
    email: clientEmail,
  });

  const doNative = async () => {
    const res = await nativeShare({ title: subject, message });
    if (res === "unsupported") {
      // Fall back to copying the message so nothing is lost.
      await copyToClipboard(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const doCopy = async () => {
    const ok = await copyToClipboard(message);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn--primary" onClick={() => setOpen((v) => !v)}>
        <Share2 size={16} /> Send
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "min(320px, 88vw)",
            zIndex: 60,
            boxShadow: "0 18px 44px rgb(15 76 129 / 22%)",
          }}
        >
          <div className="card__head">
            <h2>Send {number}</h2>
            <div className="spacer" />
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="share-actions" style={{ marginTop: 0 }}>
            <button className="btn btn--primary" onClick={doNative}>
              <Share2 size={16} /> Share with PDF…
            </button>
            <a className="btn" href={links.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <a className="btn" href={links.viber}>
              Viber
            </a>
            <a className="btn" href={links.messenger}>
              Messenger
            </a>
            <a className="btn" href={links.email}>
              Email
            </a>
            <a className="btn" href={`/api/documents/pdf?url=${encodeURIComponent(shareUrl)}`} download>
              <Download size={16} /> Download PDF
            </a>
            <button className="btn" onClick={doCopy}>
              {copied ? <Check size={16} /> : <Link2 size={16} />}
              {copied ? "Copied" : "Copy link + message"}
            </button>
          </div>

          <p className="card__hint" style={{ marginTop: 11 }}>
            Total: <strong>{formatMoney(total, currency)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
