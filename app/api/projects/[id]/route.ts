import { NextResponse } from "next/server";
import { deleteProject, getProject, parseId } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    console.error("Unable to retrieve finished project", error);
    return NextResponse.json(
      { error: "Could not retrieve project." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    const ok = await deleteProject(id);
    if (!ok) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete finished project", error);
    return NextResponse.json(
      { error: "Could not delete project." },
      { status: 500 },
    );
  }
}
