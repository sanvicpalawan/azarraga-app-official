import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { DocumentPdf } from "@/components/document-pdf";
import { pdfSettings } from "@/lib/pdf-assets";
import {
  findByShareToken,
  getSettings,
  loadDocument,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

const safe = (s: string) => s.replace(/[^\w.-]+/g, "_");

/**
 * GET /api/documents/pdf?id=<uuid>          -> staff-side download
 * GET /api/documents/pdf?url=/share/<token>  -> link taken from the Send menu
 *
 * Totals are whatever the server stored, so the PDF can never disagree with
 * the share page.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const url = searchParams.get("url");

    let doc = null;
    if (id) doc = await loadDocument(id);
    else if (url) {
      const token = url.split("/").filter(Boolean).pop();
      if (token) doc = await findByShareToken(token);
    }

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const settings = await pdfSettings(await getSettings());
    const buffer = await renderToBuffer(DocumentPdf({ doc, settings }) as never);

    const prefix = doc.type === "quote" ? "Quotation" : "Invoice";
    const filename = `${prefix}_${safe(doc.number)}_${safe(doc.client.name)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/documents/pdf", err);
    return NextResponse.json({ error: "Could not build the PDF" }, { status: 500 });
  }
}
