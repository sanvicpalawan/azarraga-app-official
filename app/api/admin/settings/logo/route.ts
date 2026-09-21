import { NextResponse } from "next/server";
import {
  getFile,
  getSettings,
  replaceLogo,
  saveFile,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function GET() {
  try {
    const settings = await getSettings();
    if (!settings.logoKey) {
      return NextResponse.json({ error: "No logo." }, { status: 404 });
    }
    const file = await getFile(settings.logoKey);
    if (!file) return NextResponse.json({ error: "Logo not found." }, { status: 404 });

    return new Response(file.body, {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": file.contentType,
        etag: file.etag,
      },
    });
  } catch (error) {
    console.error("Unable to read logo", error);
    return NextResponse.json(
      { error: "Catalog storage is unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const logo = form.get("logo");
    if (
      !(logo instanceof File) ||
      !allowedTypes.has(logo.type) ||
      logo.size > 5 * 1024 * 1024
    ) {
      return NextResponse.json(
        { error: "Upload a PNG, JPG, or WebP logo up to 5 MB." },
        { status: 400 },
      );
    }

    const extension = logo.type === "image/png" ? "png" : logo.type === "image/webp" ? "webp" : "jpg";
    const key = await saveFile("company", `logo.${extension}`, await logo.arrayBuffer(), logo.type);
    await replaceLogo(key);
    return NextResponse.json({ uploaded: true, logoUrl: "/api/admin/settings/logo" });
  } catch (error) {
    console.error("Unable to upload logo", error);
    return NextResponse.json(
      { error: "The logo could not be uploaded." },
      { status: 503 },
    );
  }
}
