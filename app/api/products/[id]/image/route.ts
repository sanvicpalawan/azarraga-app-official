import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addMedia,
  attachMediaToProduct,
  detachProductImage,
  getFile,
  getProductRecord,
  parseId,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

const attachSchema = z.object({ mediaId: z.number().int().positive() });

/** GET /api/products/:id/image — the product's current image. */
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

/**
 * POST /api/products/:id/image — upload a photo from the device. The image is
 * added to the shared library and pointed at by the product, so the same photo
 * can be reused for another product later.
 */
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

    const asset = await addMedia({
      filename: image.name || `${product.name}.png`,
      contentType: image.type,
      sizeBytes: image.size,
      body: await image.arrayBuffer(),
    });
    await attachMediaToProduct(id, asset.id);
    return NextResponse.json({
      uploaded: true,
      mediaId: asset.id,
      imageUrl: `/api/products/${id}/image`,
    });
  } catch (error) {
    console.error("Unable to upload product image", error);
    return NextResponse.json(
      { error: "The image could not be uploaded." },
      { status: 503 },
    );
  }
}

/** PUT /api/products/:id/image — use an image that is already in the library. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    const { mediaId } = attachSchema.parse(await request.json());
    const product = await attachMediaToProduct(id, mediaId);
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({
      attached: true,
      imageUrl: `/api/products/${id}/image`,
    });
  } catch (error) {
    console.error("Unable to attach product image", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Choose an image from the library."
            : "That image is not in the library.",
      },
      { status: error instanceof z.ZodError ? 400 : 404 },
    );
  }
}

/** DELETE /api/products/:id/image — unlink the image; the library keeps it. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    const product = await getProductRecord(id);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    await detachProductImage(id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to remove product image", error);
    return NextResponse.json(
      { error: "The image could not be removed." },
      { status: 400 },
    );
  }
}
