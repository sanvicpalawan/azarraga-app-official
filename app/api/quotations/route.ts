import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { quotationItems, quotations } from "@/db/schema";

const quotationSchema = z.object({
  quotationNumber: z.string().min(1),
  customerName: z.string().min(1),
  projectName: z.string().min(1),
  projectAddress: z.string().default(""),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  totalSqft: z.number().nonnegative(),
  item: z.object({
    productName: z.string().min(1),
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
  }),
});

export async function GET() {
  try {
    const rows = await getDb().select().from(quotations).orderBy(desc(quotations.updatedAt)).limit(25);
    return NextResponse.json({ quotations: rows });
  } catch (error) {
    console.error("Unable to load quotations", error);
    return NextResponse.json({ error: "Quotations are temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = quotationSchema.parse(await request.json());
    const db = getDb();

    await db.insert(quotations).values({
      quotationNumber: payload.quotationNumber,
      customerName: payload.customerName,
      projectName: payload.projectName,
      projectAddress: payload.projectAddress,
      subtotal: payload.subtotal,
      discount: payload.discount,
      grandTotal: payload.grandTotal,
      totalSqft: payload.totalSqft,
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: quotations.quotationNumber,
      set: {
        customerName: payload.customerName,
        projectName: payload.projectName,
        projectAddress: payload.projectAddress,
        subtotal: payload.subtotal,
        discount: payload.discount,
        grandTotal: payload.grandTotal,
        totalSqft: payload.totalSqft,
        updatedAt: new Date().toISOString(),
      },
    });

    const [quotation] = await db.select({ id: quotations.id })
      .from(quotations)
      .where(eq(quotations.quotationNumber, payload.quotationNumber))
      .limit(1);

    if (!quotation) {
      throw new Error("Quotation could not be created.");
    }

    await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotation.id));
    await db.insert(quotationItems).values({
      quotationId: quotation.id,
      ...payload.item,
    });

    return NextResponse.json({ id: quotation.id, saved: true });
  } catch (error) {
    console.error("Unable to save quotation", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please check the quotation fields." }, { status: 400 });
    }
    return NextResponse.json({ error: "The quotation could not be saved." }, { status: 503 });
  }
}
