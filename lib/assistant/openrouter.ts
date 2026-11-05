import { createHash } from "node:crypto";
import type { FreeModel } from "./types";
import { readConfig } from "./store";
import { decryptKey } from "./key-crypto";

const BASE = "https://openrouter.ai/api/v1";
export class AssistantError extends Error {
  constructor(message: string, public waiting = false, public retrySeconds = 300, public outputLimited = false) { super(message); }
}
export async function assistantKey() {
  const config = await readConfig();
  if (config.encryptedKey) {
    try { return decryptKey(config.encryptedKey); } catch { throw new AssistantError("The saved key could not be opened. Save your OpenRouter key again in Administration."); }
  }
  return process.env.OPENROUTER_API_KEY ?? "";
}
export async function keyFingerprint() {
  const key = await assistantKey();
  return key ? createHash("sha256").update(key).digest("hex") : "";
}
export function freeModels(rows: unknown[]): FreeModel[] {
  return rows.flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const price = row.pricing as Record<string, unknown> | undefined;
    const architecture = row.architecture as { input_modalities?: string[]; output_modalities?: string[] } | undefined;
    const id = String(row.id ?? "");
    if (!(id.endsWith(":free") || id === "openrouter/free") || !price || price.prompt == null || price.completion == null) return [];
    if (Object.values(price).some(cost => cost == null || String(cost).trim() === "" || !Number.isFinite(Number(cost)) || Number(cost) !== 0)) return [];
    if (!architecture?.input_modalities?.includes("text") || !architecture.output_modalities?.includes("text")) return [];
    const top = row.top_provider as { max_completion_tokens?: number } | undefined;
    return [{ id, name: String(row.name ?? id), vision: architecture.input_modalities.includes("image"), contextLength: Number(row.context_length ?? 0), maxCompletionTokens: Number(top?.max_completion_tokens) || 8192, supportsReasoning: Array.isArray(row.supported_parameters) && row.supported_parameters.includes("reasoning") }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
async function responseError(response: Response): Promise<never> {
  // Do not echo provider responses, which may contain request data or credentials.
  if (response.status === 429) throw new AssistantError("Free model limit reached. Waiting to retry; no paid model will be used.", true, Math.min(86400, Math.max(60, Number(response.headers.get("retry-after")) || 300)));
  if (response.status === 401 || response.status === 403) throw new AssistantError("OpenRouter rejected the server API key. Check its configuration and permissions.");
  if (response.status === 402) throw new AssistantError("OpenRouter cannot serve this free request with the current account limits. No paid request was attempted.", true);
  if (response.status >= 500 || response.status === 408) throw new AssistantError("The free provider is temporarily unavailable. Queued work is saved.", true);
  throw new AssistantError(`OpenRouter could not serve this request (${response.status}). Test the selected free model again.`);
}
export async function fetchFreeModels(): Promise<FreeModel[]> {
  const key = await assistantKey();
  const response = await fetch(`${BASE}/models`, { cache: "no-store", signal: AbortSignal.timeout(12000), headers: key ? { Authorization: `Bearer ${key}` } : {} });
  if (!response.ok) return responseError(response);
  const body = await response.json();
  if (!Array.isArray(body.data)) throw new AssistantError("OpenRouter returned an invalid model catalogue.");
  return freeModels(body.data);
}
export function parseJsonReply(content: string): unknown {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}
export async function callFreeModel(modelId: string, instruction: string, content: unknown[]): Promise<unknown> {
  const key = await assistantKey();
  if (!key) throw new AssistantError("Save your OpenRouter API key in Administration, then Test & Activate.");
  // Recheck the live catalogue for EVERY request, even after a successful test.
  const model = (await fetchFreeModels()).find(model => model.id === modelId);
  if (!model) throw new AssistantError("The selected model is no longer an eligible free model. Refresh Models and choose another.");
  let response: Response;
  try {
    response = await fetch(`${BASE}/chat/completions`, {
      method: "POST", signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-OpenRouter-Title": "Azarraga Data Assistant" },
      body: JSON.stringify({ model: model.id, max_tokens: Math.min(model.maxCompletionTokens ?? 8192, 8192),
        ...(model.supportsReasoning ? { reasoning: { effort: "low", exclude: true } } : {}),
        provider: { allow_fallbacks: false, max_price: { prompt: 0, completion: 0, request: 0, image: 0 } },
        messages: [{ role: "system", content: instruction }, { role: "user", content }],
      }),
    });
  } catch { throw new AssistantError("The free model did not respond in time. Queued work is saved for retry.", true); }
  if (!response.ok) return responseError(response);
  const body = await response.json();
  if (Number(body.usage?.cost ?? 0) > 0) throw new AssistantError("Unexpected provider pricing report. Assistant stopped; check OpenRouter usage before continuing.");
  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") throw new AssistantError("The free model used its output allowance before finishing. Retrying a smaller batch; no source data was changed.", true, 60, true);
  const contentValue = choice?.message?.content;
  const text = Array.isArray(contentValue) ? contentValue.filter(part => part?.type === "text" && typeof part.text === "string").map(part => part.text).join("") : contentValue;
  if (typeof text !== "string" || !text.trim()) throw new AssistantError(`The free model returned no product data (${String(choice?.finish_reason ?? "empty response")}). Try another free model.`);
  try { return parseJsonReply(text); } catch { throw new AssistantError("The model returned invalid JSON. Original data has not been changed."); }
}
