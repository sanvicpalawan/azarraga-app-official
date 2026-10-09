"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import { formatMoney, parseMoneyInput, type CurrencyCode } from "@/lib/currency";

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
}

/**
 * Records money received against an invoice. The amount is typed in pesos
 * and converted to centavos before it is sent - the server recomputes the
 * balance from the payment rows, never from what the browser calculated.
 */
export function PaymentPanel({
  documentId,
  total,
  amountPaid,
  currency,
  payments,
}: {
  documentId: string;
  total: number;
  amountPaid: number;
  currency: CurrencyCode;
  payments: PaymentRow[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("gcash");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = Math.max(total - amountPaid, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const centavos = parseMoneyInput(amount || "0");
    if (centavos <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payment",
          amount: centavos,
          method,
          reference: reference || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not record the payment");
      setAmount("");
      setReference("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (paymentId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/documents/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-payment", paymentId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        <div className="card__head">
          <Wallet size={17} color="#0f4c81" />
          <h2>Balance</h2>
        </div>
        <div className="total-line">
          <span>Invoice total</span>
          <strong>{formatMoney(total, currency)}</strong>
        </div>
        <div className="total-line">
          <span>Paid so far</span>
          <strong>{formatMoney(amountPaid, currency)}</strong>
        </div>
        <div className="total-line total-line--grand">
          <span>Balance due</span>
          <strong>{formatMoney(balance, currency)}</strong>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Record a payment</h2>
        </div>
        <form onSubmit={submit} style={{ display: "grid", gap: 11 }}>
          <div className="field-grid">
            <div className="field">
              <label>Amount received</label>
              <div className="money-input">
                <input
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="field">
              <label>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Reference</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="GCASH-123456"
              />
            </div>
          </div>
          {error && <div className="inline-note">{error}</div>}
          <button className="btn btn--primary" type="submit" disabled={busy}>
            <Plus size={16} /> {busy ? "Saving..." : "Record payment"}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Payment history</h2>
        </div>
        {payments.length === 0 ? (
          <p className="card__hint">Nothing recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {payments.map((p) => (
              <div key={p.id} className="total-line">
                <span>
                  {new Date(p.paidAt).toLocaleDateString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · {p.method.toUpperCase()}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>{formatMoney(p.amount, currency)}</strong>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    aria-label="Remove payment"
                    onClick={() => remove(p.id)}
                    disabled={busy}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
