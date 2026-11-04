import { NextResponse } from "next/server";
import { z } from "zod";
import { listCustomers, upsertClient } from "@/lib/documents";

const customerSchema = z.object({
  id: z.string().uuid().optional(), name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(80).nullable().optional(),
  email: z.union([z.string().email(), z.literal("")]).nullable().optional(),
  contactPerson: z.string().max(200).nullable().optional(),
  address: z.string().max(1000).nullable().optional(), tin: z.string().max(100).nullable().optional(),
});
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json({ customers: await listCustomers() }); }
export async function POST(request: Request) {
  try { const input = customerSchema.parse(await request.json()); return NextResponse.json({ id: await upsertClient(input) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Enter a customer name and valid contact details." : "The customer could not be saved." }, { status: error instanceof z.ZodError ? 400 : 503 }); }
}
