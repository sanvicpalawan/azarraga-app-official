import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listQuotations,
  saveQuotation,
  type QuotationInput,
} from "@/lib/catalog-store";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
    productName: z.string().min(1),
    productId: z.number().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    quantity: z.number().int().positive(),
    sqft: z.number().nonnegative(),
    rate: z.number().nonnegative(),
    pricingMethod: z.enum(["sqft", "unit"]),
    sectionCompany: z.string().min(1),
    sectionType: z.string().min(1),
    glass: z.string().min(1),
    color: z.string().min(1),
    lock: z.string().min(1),
    location: z.string().default(""),
    description: z.string().default(""),
    total: z.number().nonnegative(),
});
const quotationSchema = z.object({
  quotationNumber: z.string().min(1),
  customerName: z.string().min(1),
  projectName: z.string().min(1),
  projectAddress: z.string().default(""),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  totalSqft: z.number().nonnegative(),
  item: itemSchema,
  items: z.array(itemSchema).min(1).optional(),
});

export async function GET() {
  try {
    return NextResponse.json({ quotations: await listQuotations() });
  } catch (error) {
    console.error("Unable to load quotations", error);
    return NextResponse.json(
      {
        error:
          "Catalog storage is unavailable. Check the database and object storage settings.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = quotationSchema.parse(await request.json()) as QuotationInput;
    const quotation = await saveQuotation(payload);
    return NextResponse.json({ id: quotation.id, saved: true });
  } catch (error) {
    console.error("Unable to save quotation", error);
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Please check the quotation fields."
            : "The quotation could not be saved.",
      },
      { status: error instanceof z.ZodError ? 400 : 503 },
    );
  }
}
