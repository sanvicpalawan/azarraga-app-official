import { NextResponse } from "next/server";
import { z } from "zod";
import { addCategory, getCatalogSnapshot } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  return NextResponse.json({ categories: getCatalogSnapshot().categories });
}

export async function POST(request: Request) {
  try {
    const category = addCategory(schema.parse(await request.json()).name);
    return NextResponse.json({ id: category.id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create category", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Enter a category name."
            : "That category already exists.",
      },
      { status: 400 },
    );
  }
}
