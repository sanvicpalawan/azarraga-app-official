"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import type { AssistantJob, Organization } from "@/lib/assistant/types";
import type { FinishedProjectItem } from "@/lib/catalog-types";

export type ReviewData = { job: AssistantJob; source: { fileName: string; notes?: string; items: FinishedProjectItem[] } | null };
export function AssistantReview({ data, onClose, onApply }: { data: ReviewData; onClose: () => void; onApply: (items: Organization[]) => Promise<void> }) {
  const id = useId(), close = useRef<HTMLButtonElement>(null);
  const [items, setItems] = useState(data.job.proposals), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const editable = ["ready", "review"].includes(data.job.status);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; close.current?.focus(); return () => previous?.focus(); }, []);
  const change = (index: number, patch: Partial<Organization>) => setItems(previous => previous.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <div className="quote-drawing-modal ai-review-overlay" role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={event => { if (event.key === "Escape" && !busy) onClose(); }}><section className="ai-review card">
    <div className="card__head"><div><h2 id={id}>Review organization</h2><p>{data.source?.fileName ?? data.job.title}</p></div><button ref={close} className="btn" onClick={onClose} disabled={busy}>Close</button></div>
    <p>Original drawings, descriptions and historical prices stay unchanged. These labels and dimensions are used when finding products for new work.</p>
    {data.source?.notes?.includes("REVIEW REQUIRED") && <p className="ai-warning">The source has an unresolved review flag. Applying labels will not clear it.</p>}
    {items.map((item, index) => {
      const original = data.source?.items.find(source => source.id === item.id);
      return <article key={item.id} className="ai-review-item"><div className="ai-original">
        {original?.imageDataUrl ? <img src={original.imageDataUrl} alt={`Original drawing ${original.itemCode ?? item.id}`} /> : <span>No drawing in source</span>}
        <strong>{original?.itemCode ?? item.id}</strong><p>{original?.description ?? original?.name}</p>
        <p>Historical price: {original?.rate == null ? "Not recorded" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(original.rate)}</p>
      </div><div><div className="ai-fields">
        <label>Product name<input value={item.name} disabled={!editable} onChange={event => change(index, { name: event.target.value })} /></label>
        <label>Description for new quotes<textarea rows={3} value={item.description} disabled={!editable} onChange={event => change(index, { description: event.target.value })} /></label>
        <label>Category<select value={item.category} disabled={!editable} onChange={event => change(index, { category: event.target.value as Organization["category"] })}>{["Windows", "Doors", "Others"].map(category => <option key={category}>{category}</option>)}</select></label>
        {([['productType', 'Product type'], ['series', 'Series'], ['glass', 'Glass'], ['finish', 'Finish']] as const).map(([key, label]) => <label key={key}>{label}<input value={item[key]} disabled={!editable} onChange={event => change(index, { [key]: event.target.value })} /></label>)}
        <label>Width (mm)<input type="number" min="1" value={item.widthMm ?? ""} disabled={!editable} onChange={event => change(index, { widthMm: event.target.value ? Number(event.target.value) : null })} /></label>
        <label>Height (mm)<input type="number" min="1" value={item.heightMm ?? ""} disabled={!editable} onChange={event => change(index, { heightMm: event.target.value ? Number(event.target.value) : null })} /></label>
      </div>{item.notes && <p className={item.needsReview ? "ai-warning" : "page-sub"}>{item.notes}</p>}
        {item.similar.length > 0 && <p className="ai-warning">Similar existing products: {item.similar.map(other => other.name).join(", ")}. Originals will remain separate.</p>}
      </div></article>;
    })}
    {error && <p role="alert" className="ai-error">{error}</p>}
    {editable && <button className="btn btn--primary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onApply(items); onClose(); } catch (error) { setError(error instanceof Error ? error.message : "Could not apply organization."); } finally { setBusy(false); } }}>{busy ? "Applying…" : "Apply reviewed organization"}</button>}
  </section></div>;
}
