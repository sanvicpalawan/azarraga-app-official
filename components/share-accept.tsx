"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2, Phone } from "lucide-react";
import type { Document } from "@/lib/db/schema";

/**
 * The client's side of the share link: read the quotation, then accept it.
 * Accepting posts to the API, which flips the status server-side - the page
 * never trusts a hidden field.
 */
export function ShareAccept({
  documentId,
  status,
  type,
  acceptedAt,
  phone,
}: {
  documentId: string;
  status: Document["status"];
  type: Document["type"];
  acceptedAt: string | null;
  phone?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(status);
  const [error, setError] = useState<string | null>(null);

  const isAccepted = state === "accepted";

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not accept");
      setState("accepted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (type === "invoice") {
    return (
      <div className="share-accept">
        <p className="share-accept__hint">
          {isAccepted
            ? "This invoice is confirmed. Send your payment reference to Azarraga Glass & Aluminum so it can be recorded."
            : "Pay the down payment to confirm your order, then send the reference number."}
        </p>
        {phone && (
          <a className="btn btn--primary" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
            <Phone size={16} /> Call {phone}
          </a>
        )}
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="share-accept share-accept--done">
        <CheckCircle2 size={28} color="#0f4c81" />
        <div>
          <strong>Quotation accepted</strong>
          <p>
            {acceptedAt
              ? new Date(acceptedAt).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Recorded."}{" "}
            Azarraga Glass & Aluminum will contact you to arrange the 70% down payment.
          </p>
        </div>
      </div>
    );
  }

  if (state === "sent" || state === "draft") {
    return (
      <div className="share-accept">
        <div className="share-accept__actions">
          <button className="btn btn--primary" onClick={accept} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
            {busy ? "Sending..." : "Accept this quotation"}
          </button>
          <a className="btn" href={`/api/documents/pdf?id=${documentId}`} download>
            <Download size={16} /> Download PDF
          </a>
        </div>
        {phone && (
          <a className="share-accept__call" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
            Questions? Call {phone}
          </a>
        )}
        {error && <p className="share-accept__error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="share-accept">
      <p className="share-accept__hint">This quotation has already been answered.</p>
      {phone && (
        <a className="btn" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
          <Phone size={16} /> Call {phone}
        </a>
      )}
    </div>
  );
}
