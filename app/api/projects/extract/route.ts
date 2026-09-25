import { NextResponse } from "next/server";
import { extractInvoice } from "@/lib/invoice-parser";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { fileName, fileData, fileSize } = await request.json();
    if (typeof fileData !== "string" || !/^data:application\/pdf;base64,/.test(fileData))
      return NextResponse.json({ error: "Upload a text-based PDF invoice." }, { status: 400 });
    const bytes = Buffer.from(fileData.slice(fileData.indexOf(",") + 1), "base64");
    if (!bytes.length || bytes.length > 12 * 1024 * 1024)
      return NextResponse.json({ error: "PDF is empty or exceeds 12 MB." }, { status: 400 });
    const project = await extractInvoice(new Uint8Array(bytes), { fileName: String(fileName || "invoice.pdf"), fileType: "application/pdf", fileSize: Number(fileSize) || bytes.length, fileData });
    const options = [...new Set(project.items.map(item => item.quoteOption || 1))];
    const projects = options.length > 1 ? options.map(option => ({
      ...project,
      projectName: `${project.projectName} — option ${option}`,
      invoiceNumber: `${project.invoiceNumber}-option-${option}`,
      items: project.items.filter(item => item.quoteOption === option),
      totalAmount: project.items.filter(item => item.quoteOption === option).reduce((sum,item) => sum + (item.total || 0),0),
      notes: `Alternative option ${option} of ${options.length} in the same source PDF. Historical prices; confirm before reuse.`,
    })) : [project];
    return NextResponse.json({ success: true, source: "pdf-content", projects });
  } catch (error) {
    console.error("Invoice extraction failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read this invoice." }, { status: 422 });
  }
}
