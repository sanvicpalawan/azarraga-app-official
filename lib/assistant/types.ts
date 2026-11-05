export type FreeModel = { id: string; name: string; vision: boolean; contextLength: number; maxCompletionTokens?: number; supportsReasoning?: boolean };
export type AssistantConfig = {
  selectedModel: string; models: FreeModel[]; refreshedAt: string | null;
  connection: "inactive" | "active" | "waiting" | "error";
  testedAt: string | null; testedModel: string; keyFingerprint: string;
  message: string; autoImports: boolean;
  encryptedKey?: string;
};
export type Organization = {
  id: string; name: string; description: string; category: "Windows" | "Doors" | "Others";
  productType: string; series: string; glass: string; finish: string;
  widthMm: number | null; heightMm: number | null;
  needsReview: boolean; notes: string; similar: { projectId: number; itemId: string; name: string }[];
};
export type AssistantJob = {
  id: string; projectId: number; title: string; fingerprint: string;
  status: "waiting" | "processing" | "ready" | "review" | "applied" | "failed" | "discarded";
  cursor: number; total: number; proposals: Organization[]; error: string;
  model: string; retryAt: string | null; updatedAt: string; lockToken?: string; batchSize?: number;
};
export type AssistantMetadata = Organization & { projectId: number; fingerprint: string; jobId: string };
