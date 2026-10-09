"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Save, X } from "lucide-react";
import type { Settings } from "@/lib/documents";

const MAX_LOGO_BYTES = 900_000; // stays comfortably inside a text column

/**
 * Company settings the owner can change without a developer: logo, phone,
 * email, address, numbering and the terms block printed on every quotation.
 */
export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: String(settings.name ?? ""),
    address: String(settings.address ?? ""),
    phone: String(settings.phone ?? ""),
    email: String(settings.email ?? ""),
    tin: String(settings.tin ?? ""),
    logoDataUrl: (settings.logoDataUrl as string | null) ?? "",
    currency: String(settings.currency ?? "PHP"),
    vatMode: String(settings.vatMode ?? "none"),
    vatRate: String(Number(settings.vatRate ?? 12)),
    quotePrefix: String(settings.quotePrefix ?? "Q"),
    invoicePrefix: String(settings.invoicePrefix ?? "INV"),
    numberPattern: String(settings.numberPattern ?? "{prefix}{year}-{seq}"),
    numberStep: String(Number(settings.numberStep ?? 5)),
    numberPad: String(Number(settings.numberPad ?? 0)),
    quoteValidityDays: String(Number(settings.quoteValidityDays ?? 30)),
    paymentTermsDays: String(Number(settings.paymentTermsDays ?? 15)),
    defaultDepositPercent: String(Number(settings.defaultDepositPercent ?? 70)),
    defaultLeadTime: String(settings.defaultLeadTime ?? ""),
    defaultQuoteTerms: String(settings.defaultQuoteTerms ?? ""),
    defaultInvoiceTerms: String(settings.defaultInvoiceTerms ?? ""),
    paymentInstructions: String(settings.paymentInstructions ?? ""),
  });

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickLogo = (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Choose an image file (PNG, JPG or SVG).");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("That image is too large - keep it under 900 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, logoDataUrl: String(reader.result) }));
    reader.onerror = () => setLogoError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      setNotice("Settings saved. New quotations will use them straight away.");
      router.refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card">
        <div className="card__head">
          <h2>Logo</h2>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 168,
              minHeight: 92,
              display: "grid",
              placeItems: "center",
              border: "1px dashed var(--az-line)",
              borderRadius: 12,
              background: "#f8fbfe",
              padding: 8,
            }}
          >
            {form.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.logoDataUrl}
                alt="Company logo"
                style={{ maxWidth: "100%", maxHeight: 76, objectFit: "contain" }}
              />
            ) : (
              <span style={{ color: "#94a3b8", fontSize: ".78rem" }}>No logo yet</span>
            )}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => pickLogo(e.target.files?.[0])}
            />
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={16} /> {form.logoDataUrl ? "Replace logo" : "Upload logo"}
            </button>
            {form.logoDataUrl && (
              <button
                className="btn btn--danger btn--sm"
                onClick={() => setForm((f) => ({ ...f, logoDataUrl: "" }))}
              >
                <X size={14} /> Remove
              </button>
            )}
            {logoError && <span style={{ color: "#b91c1c", fontSize: ".78rem" }}>{logoError}</span>}
            <span className="card__hint">
              Shown at the top of every quotation and invoice. Under 900 KB.
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Contact details</h2>
        </div>
        <p className="card__hint">
          These print on the letterhead. Change them here when a phone number or email changes.
        </p>
        <div className="field-grid" style={{ marginTop: 12 }}>
          <div className="field field--span">
            <label>Company name</label>
            <input value={form.name} onChange={set("name")} />
          </div>
          <div className="field field--span">
            <label>Address</label>
            <input value={form.address} onChange={set("address")} />
          </div>
          <div className="field">
            <label>Phone / mobile</label>
            <input value={form.phone} onChange={set("phone")} placeholder="0917-894-1339; 0915-535-5233" />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={set("email")} inputMode="email" />
          </div>
          <div className="field">
            <label>TIN</label>
            <input value={form.tin} onChange={set("tin")} />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Money & numbering</h2>
        </div>
        <div className="field-grid">
          <div className="field">
            <label>Currency</label>
            <select value={form.currency} onChange={set("currency")}>
              <option value="PHP">₱ PHP</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
          <div className="field">
            <label>VAT</label>
            <select value={form.vatMode} onChange={set("vatMode")}>
              <option value="none">Not applied</option>
              <option value="exclusive">Added on top</option>
              <option value="inclusive">Included in price</option>
            </select>
          </div>
          <div className="field">
            <label>VAT rate (%)</label>
            <input value={form.vatRate} onChange={set("vatRate")} inputMode="decimal" />
          </div>
          <div className="field">
            <label>Default deposit (%)</label>
            <input value={form.defaultDepositPercent} onChange={set("defaultDepositPercent")} inputMode="decimal" />
          </div>
          <div className="field">
            <label>Quote prefix</label>
            <input value={form.quotePrefix} onChange={set("quotePrefix")} />
          </div>
          <div className="field">
            <label>Invoice prefix</label>
            <input value={form.invoicePrefix} onChange={set("invoicePrefix")} />
          </div>
          <div className="field">
            <label>Number format</label>
            <input value={form.numberPattern} onChange={set("numberPattern")} />
          </div>
          <div className="field">
            <label>Number step</label>
            <input value={form.numberStep} onChange={set("numberStep")} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Quote valid for (days)</label>
            <input value={form.quoteValidityDays} onChange={set("quoteValidityDays")} inputMode="numeric" />
          </div>
          <div className="field">
            <label>Invoice due in (days)</label>
            <input value={form.paymentTermsDays} onChange={set("paymentTermsDays")} inputMode="numeric" />
          </div>
          <div className="field field--span">
            <label>Default lead time</label>
            <input value={form.defaultLeadTime} onChange={set("defaultLeadTime")} placeholder="30-45 working days" />
          </div>
        </div>
        <p className="card__hint" style={{ marginTop: 10 }}>
          Numbers look like <strong>{form.quotePrefix}2026-{Number(form.numberStep) || 5}</strong>. Existing
          quotations keep the number they were created with.
        </p>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Printed terms</h2>
        </div>
        <p className="card__hint">
          Printed after the payment block on quotations. Leave blank to print nothing.
        </p>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Default quotation terms</label>
          <textarea rows={9} value={form.defaultQuoteTerms} onChange={set("defaultQuoteTerms")} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Default invoice terms</label>
          <textarea rows={5} value={form.defaultInvoiceTerms} onChange={set("defaultInvoiceTerms")} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Payment instructions</label>
          <textarea
            rows={4}
            value={form.paymentInstructions}
            onChange={set("paymentInstructions")}
            placeholder="GCash / bank details"
          />
        </div>
      </section>

      {notice && <div className="inline-note">{notice}</div>}

      <div className="sticky-save">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          <Save size={16} /> {busy ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
