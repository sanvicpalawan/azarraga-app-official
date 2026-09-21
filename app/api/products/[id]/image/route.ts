import { NextResponse } from "next/server";
import {
  clearProductImage,
  getFile,
  getProductRecord,
  parseId,
  replaceProductImage,
  saveFile,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const product = await getProductRecord(parseId((await params).id));
    if (!product?.imageKey) {
      return NextResponse.json({ error: "No product image." }, { status: 404 });
    }
    const file = await getFile(product.imageKey);
    if (!file) return NextResponse.json({ error: "Image not found." }, { status: 404 });

    const headers = new Headers({
      "cache-control": "public, max-age=3600",
      "content-type": file.contentType,
      etag: file.etag,
    });
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers.set(
        "content-disposition",
        `attachment; filename="${product.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png"`,
      );
    }
    return new Response(file.body, { headers });
  } catch (error) {
    console.error("Unable to read product image", error);
    return NextResponse.json(
      { error: "Product image is unavailable." },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    const product = await getProductRecord(id);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const form = await request.formData();
    const image = form.get("image");
    if (
      !(image instanceof File) ||
      !allowedTypes.has(image.type) ||
      image.size < 1 ||
      image.size > maxBytes
    ) {
      return NextResponse.json(
        { error: "Upload a PNG, JPG, or WebP image up to 8 MB." },
        { status: 400 },
      );
    }

    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const key = await saveFile(`products/${id}`, extension, await image.arrayBuffer(), image.type);
    await replaceProductImage(id, key);
    return NextResponse.json({ uploaded: true, imageUrl: `/api/products/${id}/image` });
  } catch (error) {
    console.error("Unable to upload product image", error);
    return NextResponse.json(
      { error: "The image could not be uploaded." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const product = await getProductRecord(parseId((await params).id));
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    await clearProductImage(product.id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to remove product image", error);
    return NextResponse.json(
      { error: "The image could not be removed." },
      { status: 400 },
    );
  }
}
