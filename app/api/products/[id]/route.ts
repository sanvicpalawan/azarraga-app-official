import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteProduct,
  parseId,
  updateProduct,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(140),
  categoryId: z.number().int().positive(),
  basePrice: z.number().nonnegative(),
  description: z.string().trim().max(1200),
  defaultSeriesId: z.number().int().positive().nullable(),
  defaultGlassId: z.number().int().positive().nullable(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    const product = updateProduct(id, schema.parse(await request.json()));
    return NextResponse.json({ saved: true, product });
  } catch (error) {
    console.error("Unable to update product", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the product fields."
            : "The product could not be updated.",
      },
      { status: error instanceof z.ZodError ? 400 : 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const product = deleteProduct(parseId((await params).id));
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete product", error);
    return NextResponse.json(
      { error: "The product could not be deleted." },
      { status: 400 },
    );
  }
}
