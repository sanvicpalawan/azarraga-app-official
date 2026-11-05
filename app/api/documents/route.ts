import { NextResponse, type NextRequest } from "next/server";
import { createDocument, listDocuments, peekNextDocumentNumber, type DocumentDraft } from "@/lib/documents";

export const dynamic = "force-dynamic";

/** GET /api/documents?type=quote&status=draft */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type");
    const status = sp.get("status");
    const limit = Number(sp.get("limit") ?? 200);

    const [items, nextNumber] = await Promise.all([
      listDocuments({
        type: type === "invoice" ? "invoice" : type === "quote" ? "quote" : undefined,
        status: status && status !== "all" ? (status as never) : undefined,
        limit: Number.isFinite(limit) ? limit : 200,
      }),
      peekNextDocumentNumber(type === "invoice" ? "invoice" : "quote"),
    ]);

    return NextResponse.json({ items, nextNumber });
  } catch (err) {
    console.error("GET /api/documents", err);
    return NextResponse.json({ error: "Could not load documents" }, { status: 500 });
  }
}

/** POST /api/documents - create a quote or invoice */
export async function POST(request: NextRequest) {
  try {
    const draft = (await request.json()) as DocumentDraft;
    if (!draft?.client?.name?.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (!draft.sections?.length) {
      return NextResponse.json({ error: "Add at least one line" }, { status: 400 });
    }

    const id = await createDocument({ ...draft, status: draft.type === "invoice" ? "unpaid" : "draft", forcedNumber: undefined });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("POST /api/documents", err);
    return NextResponse.json({ error: "Could not save the document" }, { status: 500 });
  }
}
