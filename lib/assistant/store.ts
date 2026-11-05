import { createHash, randomUUID } from "node:crypto";
import { getDb, readySchema } from "../db";
import { getProject, listProjects } from "../catalog-store";
import type { FinishedProject } from "../catalog-types";
import type { AssistantConfig, AssistantJob, AssistantMetadata } from "./types";

export const ASSISTANT_DDL = [
  `create table if not exists assistant_settings (id integer primary key, state jsonb not null default '{}'::jsonb)`,
  `create table if not exists assistant_jobs (id uuid primary key, project_id integer not null, fingerprint text not null, state jsonb not null, status text not null, locked_until timestamptz, lock_token text, next_attempt timestamptz, updated_at timestamptz not null default now(), unique(project_id,fingerprint))`,
  `create table if not exists assistant_product_metadata (project_id integer not null, item_id text not null, fingerprint text not null, data jsonb not null, job_id uuid not null, primary key(project_id,item_id))`,
];
const defaults: AssistantConfig = { selectedModel: "", models: [], refreshedAt: null, connection: "inactive", testedAt: null, testedModel: "", keyFingerprint: "", message: "Select a free model, then Test & Activate.", autoImports: true };
const root = globalThis as typeof globalThis & { __azAssistant?: { config: AssistantConfig; jobs: Map<string, AssistantJob>; locks: Map<string, number>; metadata: Map<string, AssistantMetadata> } };
function memory() { return root.__azAssistant ??= { config: structuredClone(defaults), jobs: new Map(), locks: new Map(), metadata: new Map() }; }
function local() { return !process.env.DATABASE_URL && process.env.NODE_ENV !== "production"; }
let ready: Promise<void> | null = null;
export function readyAssistant() {
  if (local()) return Promise.resolve();
  ready ??= (async () => { await readySchema(); for (const sql of ASSISTANT_DDL) await getDb().query(sql); })().catch(error => { ready = null; throw error; });
  return ready;
}
export async function readConfig(): Promise<AssistantConfig> {
  if (local()) return structuredClone(memory().config);
  await readyAssistant(); const rows = await getDb().query("select state from assistant_settings where id=1");
  return { ...defaults, ...(rows[0]?.state as Partial<AssistantConfig> ?? {}) };
}
export async function patchConfig(patch: Partial<AssistantConfig>) {
  if (local()) { memory().config = { ...memory().config, ...structuredClone(patch) }; return; }
  await readyAssistant(); await getDb().query("insert into assistant_settings(id,state) values (1,$1::jsonb) on conflict(id) do update set state=assistant_settings.state || excluded.state", [JSON.stringify(patch)]);
}
export async function sourceProject(id: number): Promise<FinishedProject | undefined> {
  if (local()) return getProject(id);
  await readySchema();
  const rows = await getDb().query("select id,project_name,client_name,project_address,invoice_number,invoice_date,total_amount,file_name,items,notes,status,created_at,updated_at from finished_projects where id=$1", [id]);
  const r = rows[0]; if (!r) return;
  return { id: Number(r.id), projectName: String(r.project_name), clientName: String(r.client_name ?? ""), projectAddress: String(r.project_address ?? ""), invoiceNumber: String(r.invoice_number ?? ""), invoiceDate: String(r.invoice_date ?? ""), totalAmount: Number(r.total_amount), fileName: String(r.file_name ?? ""), fileType: "application/pdf", fileSize: 0, items: r.items as FinishedProject["items"], notes: String(r.notes ?? ""), status: r.status as FinishedProject["status"], createdAt: String(r.created_at), updatedAt: String(r.updated_at) };
}
export function sourceFingerprint(project: FinishedProject) {
  return createHash("sha256").update(JSON.stringify({ items: project.items, notes: project.notes, fileName: project.fileName })).digest("hex");
}
export async function enqueueProject(project: FinishedProject): Promise<boolean> {
  if (!project.items.length) return false;
  const fingerprint = sourceFingerprint(project);
  const job: AssistantJob = { id: randomUUID(), projectId: project.id, title: project.fileName || project.projectName, fingerprint, status: "waiting", cursor: 0, total: project.items.length, proposals: [], error: "", model: "", retryAt: null, updatedAt: new Date().toISOString() };
  if (local()) {
    if ([...memory().jobs.values()].some(j => j.projectId === project.id && j.fingerprint === fingerprint)) return false;
    memory().jobs.set(job.id, job); return true;
  }
  await readyAssistant(); const rows = await getDb().query("insert into assistant_jobs(id,project_id,fingerprint,state,status) values($1,$2,$3,$4::jsonb,'waiting') on conflict(project_id,fingerprint) do nothing returning id", [job.id, project.id, fingerprint, JSON.stringify(job)]);
  return rows.length > 0;
}
export async function listJobs(): Promise<AssistantJob[]> {
  if (local()) return structuredClone([...memory().jobs.values()].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)));
  await readyAssistant(); const rows = await getDb().query("select state,status from assistant_jobs order by updated_at desc limit 200");
  return rows.map(row => ({ ...(row.state as AssistantJob), status: row.status as AssistantJob["status"] }));
}
export async function readJob(id: string): Promise<AssistantJob | undefined> {
  if (local()) return structuredClone(memory().jobs.get(id));
  await readyAssistant(); const rows = await getDb().query("select state,status from assistant_jobs where id=$1", [id]);
  return rows[0] ? { ...(rows[0].state as AssistantJob), status: rows[0].status as AssistantJob["status"] } : undefined;
}
export async function claimJob(): Promise<AssistantJob | undefined> {
  const token = randomUUID(), now = Date.now();
  if (local()) {
    const job = [...memory().jobs.values()].find(j => ["waiting", "processing"].includes(j.status) && (memory().locks.get(j.id) ?? 0) <= now && (!j.retryAt || Date.parse(j.retryAt) <= now));
    if (!job) return; memory().locks.set(job.id, now + 120000); job.status = "processing"; job.lockToken = token; return structuredClone(job);
  }
  await readyAssistant(); const rows = await getDb().query(`update assistant_jobs set status='processing',lock_token=$1,locked_until=now()+interval '120 seconds' where id=(select id from assistant_jobs where status in ('waiting','processing') and (locked_until is null or locked_until<now()) and (next_attempt is null or next_attempt<=now()) order by updated_at asc limit 1 for update skip locked) returning state`, [token]);
  return rows[0] ? { ...(rows[0].state as AssistantJob), status: "processing", lockToken: token } : undefined;
}
export async function saveJob(job: AssistantJob, requireLock = false) {
  const token = job.lockToken; const saved = { ...job, lockToken: undefined, updatedAt: new Date().toISOString() };
  if (local()) {
    if (requireLock && memory().jobs.get(job.id)?.lockToken !== token) throw new Error("This job changed in another session.");
    memory().jobs.set(job.id, structuredClone(saved)); memory().locks.delete(job.id); return;
  }
  await readyAssistant(); const rows = await getDb().query(`update assistant_jobs set state=$2::jsonb,status=$3,locked_until=null,lock_token=null,next_attempt=$4,updated_at=now() where id=$1 ${requireLock ? "and lock_token=$5" : ""} returning id`, [job.id, JSON.stringify(saved), job.status, job.retryAt, ...(requireLock ? [token] : [])]);
  if (!rows.length) throw new Error("This job changed in another session.");
}
export async function productMetadata(): Promise<AssistantMetadata[]> {
  if (local()) return structuredClone([...memory().metadata.values()]);
  await readyAssistant(); const rows = await getDb().query("select data from assistant_product_metadata"); return rows.map(r => r.data as AssistantMetadata);
}
export async function saveMetadata(rows: AssistantMetadata[]) {
  if (local()) { for (const row of rows) memory().metadata.set(`${row.projectId}:${row.id}`, structuredClone(row)); return; }
  await readyAssistant();
  await getDb().transaction(rows.map(row => getDb().query("insert into assistant_product_metadata(project_id,item_id,fingerprint,data,job_id) values($1,$2,$3,$4::jsonb,$5) on conflict(project_id,item_id) do update set fingerprint=excluded.fingerprint,data=excluded.data,job_id=excluded.job_id", [row.projectId, row.id, row.fingerprint, JSON.stringify(row), row.jobId])));
}
export async function invalidateMetadata(project: FinishedProject) {
  const fingerprint = sourceFingerprint(project);
  if (local()) { for (const [key, value] of memory().metadata) if (value.projectId === project.id && value.fingerprint !== fingerprint) memory().metadata.delete(key); return; }
  await readyAssistant(); await getDb().query("delete from assistant_product_metadata where project_id=$1 and fingerprint<>$2", [project.id, fingerprint]);
}
export async function similarCandidates() {
  if (local()) return (await listProjects({ includeFiles: false })).flatMap(project => project.items.map(item => ({ projectId: project.id, itemId: item.id, name: item.name, productType: item.name, category: item.category, widthMm: item.widthM == null ? null : Math.round(item.widthM * 1000), heightMm: item.heightM == null ? null : Math.round(item.heightM * 1000), series: item.series ?? "", glass: item.glass ?? "", finish: item.color ?? "" })));
  await readySchema();
  const rows = await getDb().query(`select fp.id as project_id,it.value->>'id' as item_id,it.value->>'name' as name,it.value->>'category' as category,it.value->>'widthM' as width,it.value->>'heightM' as height,it.value->>'series' as series,it.value->>'glass' as glass,it.value->>'color' as finish from finished_projects fp cross join lateral jsonb_array_elements(fp.items) it(value)`);
  return rows.map(row => ({ projectId: Number(row.project_id), itemId: String(row.item_id), name: String(row.name), productType: String(row.name), category: String(row.category), widthMm: row.width == null ? null : Math.round(Number(row.width) * 1000), heightMm: row.height == null ? null : Math.round(Number(row.height) * 1000), series: String(row.series ?? ""), glass: String(row.glass ?? ""), finish: String(row.finish ?? "") }));
}
