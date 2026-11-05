import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const root = globalThis as typeof globalThis & { __azAssistantEncryption?: Buffer };
function encryptionKey() {
  const secret = process.env.ASSISTANT_ENCRYPTION_KEY || process.env.DATABASE_URL;
  if (secret) return createHash("sha256").update(`azarraga:openrouter:key:v1:${secret}`).digest();
  if (process.env.NODE_ENV === "production") throw new Error("Server storage must be configured before saving a key.");
  return root.__azAssistantEncryption ??= randomBytes(32);
}
export function encryptKey(secret: string): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}
export function decryptKey(value: string): string {
  const [version, iv, tag, data] = value.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Invalid saved key.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
