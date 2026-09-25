import { NextResponse } from "next/server";
import { z } from "zod";
import { listProjects, saveProject } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const projectItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: z.enum(["Windows", "Doors", "Others"]),
  itemCode: z.string().optional(),
  quoteOption: z.number().optional(),
  widthM: z.number().optional(),
  heightM: z.number().optional(),
  widthFt: z.number().optional(),
  heightFt: z.number().optional(),
  quantity: z.number().optional(),
  rate: z.number().optional(),
  total: z.number().optional(),
  series: z.string().optional(),
  glass: z.string().optional(),
  color: z.string().optional(),
  lock: z.string().optional(),
  description: z.string().optional(),
  imageDataUrl: z.string().optional(),
  productId: z.number().nullable().optional(),
});

const projectInputSchema = z.object({
  id: z.number().optional(),
  projectName: z.string().min(1, "Project name is required"),
  clientName: z.string().default(""),
  projectAddress: z.string().default(""),
  invoiceNumber: z.string().default(""),
  invoiceDate: z.string().default(""),
  totalAmount: z.number().default(0),
  fileName: z.string().default(""),
  fileType: z.string().default("application/pdf"),
  fileSize: z.number().default(0),
  fileData: z.string().optional(),
  items: z.array(projectItemSchema).default([]),
  notes: z.string().optional(),
  status: z.enum(["completed", "archived", "in_progress", "historical"]).default("historical"),
});

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Unable to list finished projects", error);
    return NextResponse.json(
      { error: "Could not retrieve finished projects." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = projectInputSchema.parse(json);
    const saved = await saveProject(input);
    return NextResponse.json({ project: saved });
  } catch (error) {
    console.error("Unable to save finished project", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Please verify project information: " + error.errors[0]?.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "The project could not be saved." },
      { status: 503 },
    );
  }
}
