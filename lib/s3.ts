import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { StoredFile } from "./catalog-store-types";

const missingS3Env = (): string[] => {
  const missing: string[] = [];
  if (!process.env.S3_BUCKET) missing.push("S3_BUCKET");
  if (!process.env.AWS_REGION) missing.push("AWS_REGION");
  if (!process.env.AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!process.env.AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  return missing;
};

export function requireS3Env(): void {
  const missing = missingS3Env();
  if (missing.length > 0) {
    throw new Error(
      `Missing object storage environment variables: ${missing.join(", ")}.`,
    );
  }
}

let cachedClient: S3Client | null = null;

/**
 * S3-compatible client for the image bucket. Works against AWS S3 and any
 * S3-compatible endpoint (e.g. Cloudflare R2) via AWS_ENDPOINT_URL_S3.
 */
export function getS3Client(): S3Client {
  requireS3Env();
  if (!cachedClient) {
    cachedClient = new S3Client({
      // requireS3Env() guarantees these are present.
      region: process.env.AWS_REGION as string,
      endpoint: process.env.AWS_ENDPOINT_URL_S3 || undefined,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
      },
      forcePathStyle: true,
    });
  }
  return cachedClient;
}

export function getS3Bucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET is not set.");
  }
  return bucket;
}

export async function uploadObject(
  key: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      Body: Buffer.from(body),
      ContentType: contentType,
    }),
  );
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (
    body &&
    typeof body === "object" &&
    typeof (body as { arrayBuffer?: unknown }).arrayBuffer === "function"
  ) {
    const arrayBuffer = await (
      body as { arrayBuffer: () => Promise<ArrayBuffer> }
    ).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isObjectNotFound(error: unknown): boolean {
  const candidate = error as {
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  } | null;
  return (
    candidate?.name === "NoSuchKey" ||
    candidate?.name === "NotFound" ||
    candidate?.code === "NoSuchKey" ||
    candidate?.$metadata?.httpStatusCode === 404
  );
}

export async function getObject(
  key: string,
): Promise<StoredFile | undefined> {
  try {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: getS3Bucket(), Key: key }),
    );
    const buffer = await bodyToBuffer(response.Body);
    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    return {
      body,
      contentType: response.ContentType ?? "application/octet-stream",
      etag: response.ETag ?? "",
    };
  } catch (error) {
    if (isObjectNotFound(error)) return undefined;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key }),
  );
}

export async function headBucket(): Promise<boolean> {
  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: getS3Bucket() }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort public URL for objects in the bucket. Some S3-compatible stores
 * (e.g. Cloudflare R2) serve public buckets from a different hostname than
 * the API endpoint; set S3_PUBLIC_BASE_URL to the public hostname in that
 * case. Returns null when the public base cannot be determined.
 */
export function publicObjectBaseUrl(): string | null {
  const explicit = process.env.S3_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    return `${url.origin}/${getS3Bucket()}`;
  } catch {
    return null;
  }
}
