import { NextResponse, type NextRequest } from "next/server";
import {
  acceptDocument,
  deletePayment,
  loadDocument,
  recordPayment,
  saveDocument,
  setStatus,
  duplicateDocument,
  convertQuoteToInvoice,
  type DocumentDraft,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const doc = await loadDocument(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ document: doc });
  } catch (err) {
    console.error("GET /api/documents/[id]", err);
    return NextResponse.json({ error: "Could not load the document" }, { status: 500 });
  }
}

/** PUT /api/documents/[id] - save the header, sections and lines */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const draft = (await request.json()) as DocumentDraft;
    const totals = await saveDocument(id, draft);
    return NextResponse.json({ totals });
  } catch (err) {
    console.error("PUT /api/documents/[id]", err);
    const message = err instanceof Error ? err.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/documents/[id]
 *   { action: "duplicate" }                 -> new number, new token
 *   { action: "convert" }                   -> quote becomes a deposit invoice
 *   { action: "status", status }            -> draft / sent / declined / void
 *   { action: "accept" }                    -> client accepted on /share/[token]
 *   { action: "payment", amount, method }   -> record money received
 *   { action: "delete-payment", paymentId } -> remove a payment row
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await request.json();

    switch (body?.action) {
      case "duplicate": {
        const newId = await duplicateDocument(id);
        return NextResponse.json({ id: newId });
      }
      case "convert": {
        const invoiceId = await convertQuoteToInvoice(id);
        return NextResponse.json({ id: invoiceId });
      }
      case "status": {
        await setStatus(id, body.status);
        return NextResponse.json({ ok: true });
      }
      // The client pressed "Accept" on the share page.
      case "accept": {
        const doc = await loadDocument(id);
        if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (doc.type !== "quote") {
          return NextResponse.json({ error: "Only quotations can be accepted" }, { status: 400 });
        }
        await acceptDocument(id);
        return NextResponse.json({ ok: true, status: "accepted" });
      }
      case "payment": {
        await recordPayment({
          documentId: id,
          amount: Number(body.amount),
          method: body.method ?? "cash",
          reference: body.reference ?? null,
          notes: body.notes ?? null,
        });
        return NextResponse.json({ ok: true });
      }
      case "delete-payment": {
        await deletePayment(body.paymentId);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("POST /api/documents/[id]", err);
    const message = err instanceof Error ? err.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
