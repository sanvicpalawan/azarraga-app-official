import { NextResponse } from "next/server";
import { z } from "zod";
import { designSchema } from "@/app/api/designs/route";
import {
  addProduct,
  addMedia,
  attachMediaToProduct,
  getCatalogSnapshot,
  updateProduct,
} from "@/lib/catalog-store";
import { saveDesign } from "@/lib/designs";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  design: designSchema,
  imageDataUrl: z.string().startsWith("data:image/png;base64,").max(12_000_000),
});

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function productKey(designId: string): string {
  return `OPEN-${designId.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const { design, imageDataUrl } = requestSchema.parse(await request.json());
    const catalog = await getCatalogSnapshot();
    const category = catalog.categories.find((item) => item.name === (design.section ?? "Windows"))
      ?? catalog.categories.find((item) => item.name === "Others")
      ?? catalog.categories[0];
    if (!category) throw new Error("No product category is available.");

    const key = productKey(design.id);
    const existing = catalog.products.find((item) => item.designId === design.id);
    const seriesNeedle = normalized(design.series ?? "");
    const series = catalog.attributes.find((item) => item.type === "series" && seriesNeedle && (
      normalized(item.name) === seriesNeedle ||
      (item.name.match(/\d+/)?.[0] && item.name.match(/\d+/)?.[0] === design.series?.match(/\d+/)?.[0])
    ));
    const glassNeedle = normalized(`${design.spec?.glassMm || ""}mm ${design.spec?.glassType || ""}`);
    const glass = catalog.attributes.find((item) => item.type === "glass" && glassNeedle && normalized(item.name).startsWith(glassNeedle.replace(/clear$/, "")));
    const input = {
      name: design.name.trim() || `Owner Design ${key}`,
      categoryId: category.id,
      basePrice: 0,
      description: design.description.trim() || "Owner-designed custom product from Designer Studio.",
      defaultSeriesId: series?.id ?? null,
      defaultGlassId: glass?.id ?? null,
      productKey: key,
      designId: design.id,
      isCustom: true,
    };

    const product = existing
      ? await updateProduct(existing.id, input)
      : await addProduct(input);

    const bytes = Buffer.from(imageDataUrl.slice("data:image/png;base64,".length), "base64");
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const filename = `${input.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || key}.png`;
    const media = await addMedia({
      filename,
      contentType: "image/png",
      sizeBytes: bytes.byteLength,
      body,
    });
    await attachMediaToProduct(product.id, media.id);
    await saveDesign(design);

    return NextResponse.json({ saved: true, productId: product.id, productKey: key });
  } catch (error) {
    console.error("Unable to publish Designer Studio product", error);
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Please check the design data." : "The open product could not be saved." },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}
