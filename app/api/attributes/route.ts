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
  return NextResponse.json({ attributes: getCatalogSnapshot().attributes });
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const attribute = addAttribute(input.type as AttributeType, input.name);
    return NextResponse.json({ id: attribute.id, created: true }, { status: 201 });
  } catch (error) {
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
