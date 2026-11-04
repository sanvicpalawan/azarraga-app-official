import { NextResponse } from "next/server";
import { z } from "zod";
import { designSchema } from "@/lib/design-schema";
import { listDesigns, saveDesign } from "@/lib/designs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ designs: await listDesigns() }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load designs", error);
    return NextResponse.json({ error: "Designer storage is unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const design = designSchema.parse(await request.json());
    await saveDesign(design);
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to save design", error);
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Please check the design data." : "The design could not be saved." },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}
