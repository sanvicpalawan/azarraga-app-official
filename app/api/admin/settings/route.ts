import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, updateSettings } from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const schema = z.object({
  companyName: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300),
  contactNumbers: z.string().trim().max(120),
  email: z.string().trim().email().or(z.literal("")),
  tin: z.string().trim().max(80),
  bankAccountName: z.string().trim().max(120),
  bankAccountNumber: z.string().trim().max(120),
  bankName: z.string().trim().max(120),
  bankBranch: z.string().trim().max(120),
  termsConditions: z.string().trim().min(1).max(2000),
  pdfHeader: z.string().trim().min(1).max(180),
});

export async function GET() {
  return NextResponse.json(
    { settings: getSettings() },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  try {
    const settings = updateSettings(schema.parse(await request.json()));
    return NextResponse.json({ saved: true, settings });
  } catch (error) {
    console.error("Unable to update settings", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check the company profile fields."
            : "Company settings could not be saved.",
      },
      { status: error instanceof z.ZodError ? 400 : 400 },
    );
  }
}
