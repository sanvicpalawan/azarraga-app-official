import { NextResponse } from "next/server";
import { z } from "zod";
import { listDesigns, saveDesign } from "@/lib/designs";

export const dynamic = "force-dynamic";

const shapeSchema = z.discriminatedUnion("t", [
  z.object({ id: z.string(), t: z.literal("rect"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), sym: z.enum(["none", "louver", "F", "L", "R", "LR", "awning", "tilt", "swingL", "swingR"]) }),
  z.object({ id: z.string(), t: z.literal("arch"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), sym: z.enum(["none", "louver", "F", "L", "R", "LR", "awning", "tilt", "swingL", "swingR"]) }),
  z.object({ id: z.string(), t: z.literal("line"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
  z.object({ id: z.string(), t: z.literal("arrow"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
  z.object({ id: z.string(), t: z.literal("text"), x: z.number(), y: z.number(), text: z.string(), size: z.number() }),
]);

export const designSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
  shapes: z.array(shapeSchema),
  updatedAt: z.string(),
  unit: z.enum(["m", "mm", "ft"]).optional(),
  section: z.enum(["Windows", "Doors", "Others"]).optional(),
  type: z.string().optional(),
  series: z.string().optional(),
  spec: z.object({
    glassMm: z.number(), glassType: z.string(), frame: z.string(),
    hardware: z.string(), profileMm: z.number(), finish: z.string(),
  }).optional(),
});

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
