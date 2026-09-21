import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteCategory,
  parseId,
  updateCategory,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const category = await updateCategory(
      parseId((await params).id),
      schema.parse(await request.json()).name,
    );
    return NextResponse.json({ saved: true, category });
  } catch (error) {
    console.error("Unable to update category", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Enter a category name."
            : "Category could not be updated.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await deleteCategory(parseId((await params).id)))) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete category", error);
    return NextResponse.json(
      { error: "Move or delete the products in this category first." },
      { status: 409 },
    );
  }
}
