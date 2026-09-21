import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { parseId } from "@/lib/catalog-db";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    if (!env.BUCKET) throw new Error("R2 unavailable");
    const product = await getRawDb().prepare("SELECT image_key AS imageKey, name FROM products WHERE id = ?").bind(id).first<{ imageKey: string | null; name: string }>();
    if (!product?.imageKey) return NextResponse.json({ error: "No product image." }, { status: 404 });
    const object = await env.BUCKET.get(product.imageKey);
    if (!object) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=3600");
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers.set("content-disposition", `attachment; filename="${product.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png"`);
    }
    return new Response(object.body, { headers });
  } catch (error) {
    console.error("Unable to read product image", error);
    return NextResponse.json({ error: "Product image is unavailable." }, { status: 404 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    if (!env.BUCKET) throw new Error("R2 unavailable");
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || !allowedTypes.has(image.type) || image.size < 1 || image.size > maxBytes) {
      return NextResponse.json({ error: "Upload a PNG, JPG, or WebP image up to 8 MB." }, { status: 400 });
    }
    const db = getRawDb();
    const existing = await db.prepare("SELECT image_key AS imageKey FROM products WHERE id = ?").bind(id).first<{ imageKey: string | null }>();
    if (!existing) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const key = `products/${id}/${crypto.randomUUID()}.${extension}`;
    await env.BUCKET.put(key, await image.arrayBuffer(), { httpMetadata: { contentType: image.type } });
    await db.prepare("UPDATE products SET image_key = ?, image_path = NULL, updated_at = ? WHERE id = ?").bind(key, new Date().toISOString(), id).run();
    if (existing.imageKey) await env.BUCKET.delete(existing.imageKey);
    return NextResponse.json({ uploaded: true, imageUrl: `/api/products/${id}/image` });
  } catch (error) {
    console.error("Unable to upload product image", error);
    return NextResponse.json({ error: "The image could not be uploaded." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    const db = getRawDb();
    const row = await db.prepare("SELECT image_key AS imageKey FROM products WHERE id = ?").bind(id).first<{ imageKey: string | null }>();
    if (row?.imageKey && env.BUCKET) await env.BUCKET.delete(row.imageKey);
    await db.prepare("UPDATE products SET image_key = NULL, image_path = NULL, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "The image could not be removed." }, { status: 400 });
  }
}
