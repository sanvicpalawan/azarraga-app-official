"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantConfig, AssistantJob, Organization } from "@/lib/assistant/types";
import { AssistantReview, type ReviewData } from "./assistant-review";
import "./assistant.css";

type Config = Pick<AssistantConfig, "selectedModel" | "models" | "refreshedAt" | "connection" | "message" | "testedAt" | "autoImports"> & { keyConfigured: boolean };
type Overview = { config: Config; jobs: AssistantJob[]; result?: AssistantJob | { queued: number } | null };
const EVENT = "azarraga:assistant-updated";
async function request(body?: Record<string, unknown>): Promise<Overview> {
  const response = await fetch("/api/assistant", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Assistant is unavailable. Your source documents are safe."); return data;
}
const date = (value: string | null) => value ? new Date(value).toLocaleString("en-PH") : "Not yet";
export function AssistantSettings() {
  const [data, setData] = useState<Overview | null>(null), [key, setKey] = useState(""), [busy, setBusy] = useState(""), [error, setError] = useState("");
  useEffect(() => { let alive = true; request().then(async data => { if (!alive) return; setData(data); if (!data.config.refreshedAt || Date.now() - Date.parse(data.config.refreshedAt) > 86400000) { try { const refreshed = await request({ action: "refresh" }); if (alive) setData(refreshed); } catch { /* Manual Refresh remains available; saving a key does not depend on catalogue availability. */ } } }).catch(error => { if (alive) setError(error.message); }); return () => { alive = false; }; }, []);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action); setError("");
    try { const next = await request({ action, ...payload }); setData(next); if (action === "save-key") setKey(""); window.dispatchEvent(new Event(EVENT)); }
    catch (error) { setError(error instanceof Error ? error.message : "Action failed."); const next = await request().catch(() => null); if (next) setData(next); }
    finally { setBusy(""); }
  }
  const config = data?.config;
  return <section className="card ai-settings"><div className="card__head"><h2>OpenRouter · free models only</h2><span className={`ai-light ai-light--${config?.connection ?? "inactive"}`}><i aria-hidden="true" />{config?.connection === "active" ? "Activated" : config?.connection === "waiting" ? "Waiting" : config?.connection === "error" ? "Connection failed" : "Not activated"}</span></div>
    <p role="status">{config?.message ?? "Loading assistant settings…"}</p>
    <div className="ai-fields"><label>OpenRouter API key<input aria-label="OpenRouter API key" type="password" autoComplete="off" value={key} placeholder={config?.keyConfigured ? "Saved privately · paste here to replace" : "Paste your OpenRouter API key"} onChange={event => setKey(event.target.value)} /></label><div className="ai-key-actions"><button className="btn" disabled={Boolean(busy) || !key.trim()} onClick={() => void act("save-key", { key })}>{busy === "save-key" ? "Saving…" : "Save Key"}</button><span>{config?.keyConfigured ? "Key saved on server" : "No key saved"}</span></div></div>
    <p className="page-sub">Your saved key is encrypted. It is never displayed or returned to this browser.</p>
    <div className="ai-fields"><label>Free model<select aria-label="Free model" disabled={Boolean(busy) || !config?.models.length} value={config?.selectedModel ?? ""} onChange={event => void act("select", { model: event.target.value, autoImports: config?.autoImports ?? true })}><option value="">Choose a free model</option>{config?.selectedModel && !config.models.some(model => model.id === config.selectedModel) && <option value={config.selectedModel}>Unavailable: {config.selectedModel}</option>}{config?.models.map(model => <option key={model.id} value={model.id}>{model.name} · {model.vision ? "Text + images" : "Text only"}</option>)}</select></label><div className="ai-buttons"><button className="btn" disabled={Boolean(busy)} onClick={() => void act("refresh")}>{busy === "refresh" ? "Refreshing…" : "Refresh Models"}</button><button className="btn btn--primary" disabled={Boolean(busy) || !config?.selectedModel || !config.keyConfigured} onClick={() => void act("activate")}>{busy === "activate" ? "Testing extraction…" : "Test & Activate"}</button></div></div>
    <div className="ai-timestamps"><span>Models refreshed: {date(config?.refreshedAt ?? null)}</span><span>Last successful test: {date(config?.testedAt ?? null)}</span></div>
    {config?.selectedModel && <p className="page-sub">{config.models.find(model => model.id === config.selectedModel)?.vision ? "This model can inspect original drawing images and extracted text." : "Text model: original drawings are preserved, but visual interpretation is unavailable."}</p>}
    <label className="ai-check"><input type="checkbox" checked={config?.autoImports ?? true} disabled={Boolean(busy) || !config?.selectedModel} onChange={event => void act("select", { model: config?.selectedModel, autoImports: event.target.checked })} />Automatically queue new imports and process while a Studio or assistant page is open</label>
    <p className="page-sub">Only zero-price models and providers are allowed. No paid fallback or paid document tools. The green light requires a successful extraction test and expires after 24 hours.</p>
    {error && <p className="ai-error" role="alert">{error}</p>}
  </section>;
}
export function DataOrganizer({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Overview | null>(null), [running, setRunning] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [review, setReview] = useState<ReviewData | null>(null);
  const working = useRef(false), stop = useRef(false), paused = useRef(false), alive = useRef(true);
  const run = useCallback(async () => {
    if (working.current) return; working.current = true; stop.current = false; paused.current = false; setRunning(true); setError("");
    try {
      while (!stop.current) {
        const next = await request({ action: "run" }); if (!alive.current) break; setData(next);
        const result = next.result as AssistantJob | null;
        if (!result || result.retryAt || !["active", "waiting"].includes(next.config.connection)) break;
      }
    } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "Processing paused."); }
    finally { working.current = false; if (alive.current) setRunning(false); }
  }, []);
  useEffect(() => {
    alive.current = true;
    const load = async () => {
      if (working.current || document.visibilityState === "hidden") return;
      try { const next = await request(); if (!alive.current) return; setData(next); if (!paused.current && next.config.autoImports && ["active", "waiting"].includes(next.config.connection) && next.config.testedAt && next.jobs.some(job => ["waiting", "processing"].includes(job.status) && (!job.retryAt || Date.parse(job.retryAt) <= Date.now()))) void run(); }
      catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "Could not load jobs."); }
    };
    void load(); const interval = setInterval(() => void load(), 60000); window.addEventListener(EVENT, load); document.addEventListener("visibilitychange", load);
    return () => { alive.current = false; stop.current = true; clearInterval(interval); window.removeEventListener(EVENT, load); document.removeEventListener("visibilitychange", load); };
  }, [run]);
  async function enqueue() {
    setBusy(true); setError(""); let queued = 0;
    try {
      const response = await fetch("/api/projects?summary=1", { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error("Could not load source documents.");
      const ids: number[] = body.sources.map((source: { id: number }) => source.id);
      for (let index = 0; index < ids.length; index += 10) { const next = await request({ action: "enqueue", projectIds: ids.slice(index, index + 10) }); setData(next); queued += (next.result as { queued: number }).queued; }
      setNotice(queued ? `${queued} source documents queued. Original records remain intact.` : "These source documents are already queued or organized.");
      window.dispatchEvent(new Event(EVENT));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not queue documents."); } finally { setBusy(false); }
  }
  async function action(action: string, job: AssistantJob) {
    setBusy(true); setError(""); try { setData(await request({ action, id: job.id })); } catch (error) { setError(error instanceof Error ? error.message : "Action failed."); } finally { setBusy(false); }
  }
  async function open(job: AssistantJob) {
    setBusy(true); setError(""); try { const response = await fetch(`/api/assistant?job=${job.id}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setReview(body); } catch (error) { setError(error instanceof Error ? error.message : "Could not open review."); } finally { setBusy(false); }
  }
  return <section className="card ai-organizer"><div className="card__head"><div><h2>Data Organizer</h2><p>Organize real product data for Studio and product search.</p></div>{compact && <Link className="btn" href="/admin/assistant">AI settings</Link>}</div>
    <div className="ai-buttons"><button className="btn" disabled={busy || running} onClick={() => void enqueue()}>{busy ? "Working…" : "Organize existing library"}</button><button className="btn btn--primary" disabled={busy || running || !data?.config.testedAt || !["active", "waiting"].includes(data?.config.connection ?? "")} onClick={() => void run()}>Process queue</button>{running && <button className="btn" onClick={() => { stop.current = true; paused.current = true; setNotice("Stopping after this batch. Progress is saved."); }}>Stop after current batch</button>}</div>
    <p className="page-sub">{running ? "Processing · progress is saved after each batch." : "Queued work is saved. Processing resumes here while this page is open."} {data?.config.connection !== "active" && <Link href="/admin/assistant">Check assistant connection</Link>}</p>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="ai-error">{error}</p>}
    <div className="ai-jobs">{data?.jobs.length === 0 && <p>No documents queued yet. Import a PDF or organize your existing library.</p>}{data?.jobs.map(job => <article className="ai-job" key={job.id}><div><strong>{job.title}</strong><span className={`ai-job-state ai-job-state--${job.status}`}>{({ waiting: "Waiting", processing: "Processing", ready: "Ready to review", review: "Needs review", applied: "Applied", failed: "Needs attention", discarded: "Discarded" })[job.status]}</span><p>{job.cursor} / {job.total} items · {job.model || "Model not used yet"}</p>{job.error && <p className="ai-warning">{job.error}</p>}{job.retryAt && <p>Retry after {date(job.retryAt)}</p>}</div><div className="ai-buttons">{job.proposals.length > 0 && <button className="btn" disabled={busy} onClick={() => void open(job)}>{job.status === "applied" ? "View organization" : "Review items"}</button>}{["failed", "discarded", "applied"].includes(job.status) && <button className="btn" disabled={busy || running} onClick={() => void action("retry", job)}>Re-analyze</button>}{!["processing", "applied", "discarded"].includes(job.status) && <button className="btn btn--ghost" disabled={busy || running} onClick={() => void action("discard", job)}>Discard proposal</button>}</div></article>)}</div>
    {review && <AssistantReview key={`${review.job.id}:${review.job.updatedAt}`} data={review} onClose={() => setReview(null)} onApply={async (proposals: Organization[]) => { setData(await request({ action: "apply", id: review.job.id, proposals })); setNotice("Organization applied. Original drawings and prices are unchanged."); window.dispatchEvent(new Event(EVENT)); }} />}
  </section>;
}
