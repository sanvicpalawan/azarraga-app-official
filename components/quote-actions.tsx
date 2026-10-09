"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2 } from "lucide-react";

/**
 * Quote lifecycle controls: turn an approved quote into the 70% deposit
 * invoice. Conversion runs server-side and returns the new invoice id.
 */
export function QuoteActions({
  documentId,
  status,
  hasInvoice,
}: {
  documentId: string;
  status: string;
  hasInvoice: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convert = async () => {
    const depositReady = status === "accepted" || status === "approved";
    if (
      !depositReady &&
      !window.confirm(
        "This quotation has not been accepted yet. Convert it to an invoice anyway?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not convert");
      router.push(`/invoices/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not convert");
      setBusy(false);
    }
  };

  if (hasInvoice) {
    return <span className="inline-note">Already converted to an invoice.</span>;
  }

  return (
    <div style={{ display: "grid", gap: 7 }}>
      <button className="btn btn--primary" onClick={convert} disabled={busy}>
        {busy ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
        {busy ? "Converting..." : "Convert to invoice"}
      </button>
      {error && <span className="inline-note">{error}</span>}
    </div>
  );
}
