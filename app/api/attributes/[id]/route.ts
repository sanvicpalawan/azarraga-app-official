import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteAttribute,
  parseId,
  updateAttribute,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().trim().min(1).max(100) });

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const attribute = await updateAttribute(
      parseId((await params).id),
      schema.parse(await request.json()).name,
    );
    return NextResponse.json({ saved: true, attribute });
  } catch (error) {
    console.error("Unable to update attribute", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Enter an option name."
            : "The option could not be updated.",
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
    if (!(await deleteAttribute(parseId((await params).id)))) {
      return NextResponse.json({ error: "Option not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete attribute", error);
    return NextResponse.json(
      { error: "This option is a product default. Update those products first." },
      { status: 409 },
    );
  }
}
