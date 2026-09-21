import { NextResponse } from "next/server";
import { deleteDesign } from "@/lib/designs";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const removed = await deleteDesign(id);
    return removed
      ? NextResponse.json({ deleted: true })
      : NextResponse.json({ error: "Design not found." }, { status: 404 });
  } catch (error) {
    console.error("Unable to delete design", error);
    return NextResponse.json({ error: "The design could not be deleted." }, { status: 503 });
  }
}
