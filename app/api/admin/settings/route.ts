import { NextResponse } from "next/server";
import { z } from "zod";
import { getRawDb } from "@/db";
import { ensureCatalogDefaults } from "@/lib/catalog-db";

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
  try {
    await ensureCatalogDefaults();
    const settings = await getRawDb().prepare(`SELECT id, company_name AS companyName,
      logo_key AS logoKey, address, contact_numbers AS contactNumbers, email, tin,
      bank_account_name AS bankAccountName, bank_account_number AS bankAccountNumber,
      bank_name AS bankName, bank_branch AS bankBranch, terms_conditions AS termsConditions,
      pdf_header AS pdfHeader, updated_at AS updatedAt FROM global_settings WHERE id = 1`).first();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Unable to load settings", error);
    return NextResponse.json({ error: "Company settings are unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await ensureCatalogDefaults();
    await getRawDb().prepare(`UPDATE global_settings SET
      company_name = ?, address = ?, contact_numbers = ?, email = ?, tin = ?,
      bank_account_name = ?, bank_account_number = ?, bank_name = ?, bank_branch = ?,
      terms_conditions = ?, pdf_header = ?, updated_at = ? WHERE id = 1`)
      .bind(input.companyName, input.address, input.contactNumbers, input.email, input.tin,
        input.bankAccountName, input.bankAccountNumber, input.bankName, input.bankBranch,
        input.termsConditions, input.pdfHeader, new Date().toISOString())
      .run();
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to update settings", error);
    return NextResponse.json({ error: error instanceof z.ZodError ? "Check the company profile fields." : "Company settings could not be saved." }, { status: error instanceof z.ZodError ? 400 : 503 });
  }
}
