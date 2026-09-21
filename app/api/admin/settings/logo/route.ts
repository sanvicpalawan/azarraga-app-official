import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureCatalogDefaults } from "@/lib/catalog-db";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET() {
  try {
    if (!env.BUCKET) throw new Error("R2 unavailable");
    await ensureCatalogDefaults();
    const row = await getRawDb().prepare("SELECT logo_key AS logoKey FROM global_settings WHERE id = 1").first<{ logoKey: string | null }>();
    if (!row?.logoKey) return NextResponse.json({ error: "No logo." }, { status: 404 });
    const object = await env.BUCKET.get(row.logoKey);
    if (!object) return NextResponse.json({ error: "Logo not found." }, { status: 404 });
    const headers = new Headers({ "cache-control": "public, max-age=3600" });
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  } catch {
    return NextResponse.json({ error: "Logo unavailable." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    if (!env.BUCKET) throw new Error("R2 unavailable");
    await ensureCatalogDefaults();
    const form = await request.formData();
    const logo = form.get("logo");
    if (!(logo instanceof File) || !allowedTypes.has(logo.type) || logo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Upload a PNG, JPG, or WebP logo up to 5 MB." }, { status: 400 });
    }
    const db = getRawDb();
    const current = await db.prepare("SELECT logo_key AS logoKey FROM global_settings WHERE id = 1").first<{ logoKey: string | null }>();
    const key = `company/logo-${crypto.randomUUID()}`;
    await env.BUCKET.put(key, await logo.arrayBuffer(), { httpMetadata: { contentType: logo.type } });
    await db.prepare("UPDATE global_settings SET logo_key = ?, updated_at = ? WHERE id = 1").bind(key, new Date().toISOString()).run();
    if (current?.logoKey) await env.BUCKET.delete(current.logoKey);
    return NextResponse.json({ uploaded: true, logoUrl: "/api/admin/settings/logo" });
  } catch (error) {
    console.error("Unable to upload logo", error);
    return NextResponse.json({ error: "The logo could not be uploaded." }, { status: 503 });
  }
}
