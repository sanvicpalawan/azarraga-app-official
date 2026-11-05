import { NextResponse } from "next/server";
import { z } from "zod";
import { activateAssistant, applyJob, assistantOverview, enqueueSources, refreshModels, runNextJob, saveAssistantKey, selectModel, updateJob } from "@/lib/assistant/service";
import { readJob, sourceProject } from "@/lib/assistant/store";
import { AssistantError } from "@/lib/assistant/openrouter";
import type { Organization } from "@/lib/assistant/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-key"), key: z.string().min(16).max(1000) }),
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("select"), model: z.string().max(200), autoImports: z.boolean() }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("enqueue"), projectIds: z.array(z.number().int().positive()).max(10) }),
  z.object({ action: z.literal("run") }),
  z.object({ action: z.literal("apply"), id: z.string().uuid(), proposals: z.array(z.unknown()).max(500).optional() }),
  z.object({ action: z.literal("retry"), id: z.string().uuid() }),
  z.object({ action: z.literal("discard"), id: z.string().uuid() }),
]);
const headers = { "cache-control": "no-store" };
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("job");
    if (id) {
      if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid job." }, { status: 400, headers });
      const job = await readJob(id);
      if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404, headers });
      const source = await sourceProject(job.projectId);
      return NextResponse.json({ job, source: source ? { fileName: source.fileName, notes: source.notes?.split("SOURCE_TEXT:")[0], items: source.items } : null }, { headers });
    }
    return NextResponse.json(await assistantOverview(), { headers });
  } catch { return NextResponse.json({ error: "Assistant data could not be loaded. Existing quotations are unaffected." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  try {
    const input = actionSchema.parse(await request.json());
    let result: unknown = null;
    switch (input.action) {
      case "save-key": await saveAssistantKey(input.key); break;
      case "refresh": await refreshModels(); break;
      case "select": await selectModel(input.model, input.autoImports); break;
      case "activate": await activateAssistant(); break;
      case "enqueue": result = { queued: await enqueueSources(input.projectIds) }; break;
      case "run": result = await runNextJob(); break;
      case "apply": await applyJob(input.id, input.proposals as Organization[] | undefined); break;
      case "retry": case "discard": await updateJob(input.id, input.action); break;
    }
    return NextResponse.json({ ...await assistantOverview(), result }, { headers });
  } catch (error) {
    const message = error instanceof z.ZodError ? "Check the supplied assistant fields." : error instanceof AssistantError ? error.message : error instanceof Error && /Source changed|review|batch|Job not found/i.test(error.message) ? error.message : "Assistant action failed. Original documents and prices are unchanged.";
    return NextResponse.json({ error: message, waiting: error instanceof AssistantError && error.waiting }, { status: error instanceof z.ZodError ? 400 : error instanceof AssistantError && error.waiting ? 429 : 503, headers });
  }
}
