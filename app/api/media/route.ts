import { NextResponse } from "next/server";
import { addMedia, listMedia } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

/** GET /api/media — every image in the library, newest first. */
export async function GET() {
  try {
    return NextResponse.json(
      { media: await listMedia() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load image library", error);
    return NextResponse.json(
      {
        error:
          "Catalog storage is unavailable. Check the database and object storage settings.",
      },
      { status: 503 },
    );
  }
}

/** POST /api/media — upload one image from the device into the library. */
export async function POST(request: Request) {
  try {
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
      filename: image.name || "image",
      contentType: image.type,
      sizeBytes: image.size,
      body: await image.arrayBuffer(),
    });
    return NextResponse.json({ uploaded: true, media: asset }, { status: 201 });
  } catch (error) {
    console.error("Unable to upload image", error);
    return NextResponse.json(
      { error: "The image could not be uploaded." },
      { status: 503 },
    );
  }
}
