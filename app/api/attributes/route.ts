import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addAttribute,
  getCatalogSnapshot,
  type AttributeType,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(["series", "glass", "color", "lock"]),
  name: z.string().trim().min(1).max(100),
});

export async function GET() {
  try {
    return NextResponse.json({
      attributes: (await getCatalogSnapshot()).attributes,
    });
  } catch (error) {
    console.error("Unable to load attributes", error);
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
    const input = schema.parse(await request.json());
    const attribute = await addAttribute(input.type as AttributeType, input.name);
    return NextResponse.json({ id: attribute.id, created: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to create attribute", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Choose a type and enter a name."
            : "That option already exists.",
      },
      { status: 400 },
    );
  }
}
