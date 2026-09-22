import { NextResponse } from "next/server";
import {
  deleteMedia,
  getFile,
  getMedia,
  parseId,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

/** GET /api/media/:id — stream the stored image bytes. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const asset = await getMedia(parseId((await params).id));
    if (!asset) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    const file = await getFile(asset.key);
    if (!file) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    const headers = new Headers({
      "cache-control": "public, max-age=3600",
      "content-type": file.contentType,
      etag: file.etag,
    });
    if (new URL(request.url).searchParams.get("download") === "1") {
      const safeName = asset.filename.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
      headers.set("content-disposition", `attachment; filename="${safeName}"`);
    }
    return new Response(file.body, { headers });
  } catch (error) {
    console.error("Unable to read library image", error);
    return NextResponse.json(
      { error: "Image is unavailable." },
      { status: 404 },
    );
  }
}

/** DELETE /api/media/:id — remove an image that no product is using. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await deleteMedia(parseId((await params).id)))) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete library image", error);
    return NextResponse.json(
      {
        error:
          "This image is used by a product. Remove it from that product first.",
      },
      { status: 409 },
    );
  }
}
