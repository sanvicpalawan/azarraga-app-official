import { NextResponse } from "next/server";
import { z } from "zod";
import { addProduct, getCatalogSnapshot } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export const productSchema = z.object({
  name: z.string().trim().min(1).max(140),
  categoryId: z.number().int().positive(),
  basePrice: z.number().nonnegative(),
  description: z.string().trim().max(1200),
  defaultSeriesId: z.number().int().positive().nullable(),
  defaultGlassId: z.number().int().positive().nullable(),
});

export async function GET() {
  try {
    return NextResponse.json({ products: (await getCatalogSnapshot()).products });
  } catch (error) {
    console.error("Unable to load products", error);
    return NextResponse.json(
      {
        error:
          "Catalog storage is unavailable. Check the database and object storage settings.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const product = await addProduct(productSchema.parse(await request.json()));
    return NextResponse.json({ id: product.id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create product", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the product fields."
            : "The product could not be created.",
      },
      { status: error instanceof z.ZodError ? 400 : 409 },
    );
  }
}
