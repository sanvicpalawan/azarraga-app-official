import { NextResponse, type NextRequest } from "next/server";
import { getSettings, saveSettings } from "@/lib/documents";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (err) {
    console.error("GET /api/settings/company", err);
    return NextResponse.json({ error: "Could not load settings" }, { status: 500 });
  }
}

/** PUT /api/settings/company - the owner edits logo and contact details. */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const patch: Record<string, unknown> = {};
    const text = (key: string) => {
      if (typeof body[key] === "string") patch[key] = body[key];
    };
    const num = (key: string) => {
      if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
        const n = Number(body[key]);
        if (Number.isFinite(n)) patch[key] = n;
      }
    };

    text("name");
    text("address");
    text("phone");
    text("email");
    text("tin");
    text("logoDataUrl");
    text("quotePrefix");
    text("invoicePrefix");
    text("numberPattern");
    text("defaultLeadTime");
    text("defaultQuoteTerms");
    text("defaultInvoiceTerms");
    text("defaultNotes");
    text("paymentInstructions");
    text("currency");
    text("vatMode");

    num("vatRate");
    num("numberStep");
    num("numberPad");
    num("quoteValidityDays");
    num("paymentTermsDays");
    num("defaultDepositPercent");

    await saveSettings(patch as never);
    return NextResponse.json({ settings: await getSettings() });
  } catch (err) {
    console.error("PUT /api/settings/company", err);
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }
}
