import { z } from "zod";
import type { DocumentDraft } from "./documents";
const money = z.number().finite().int().nonnegative();
const dimension = z.number().finite().int().positive().nullable().optional();
const line = z.object({ description:z.string().trim().min(1).max(5000), quantity:z.number().finite().positive().optional(), unitPrice:money.optional(), widthMm:dimension,heightMm:dimension,lengthMm:dimension,
  pricingMode:z.enum(["per_unit","per_area"]).optional(),areaUnit:z.enum(["sqm","sqft"]).optional(),
  inputUnit:z.enum(["m","mm","ft-in"]).optional(), minArea:z.number().finite().nonnegative().optional(),
  options:z.array(z.object({groupId:z.string(),groupName:z.string(),optionId:z.string(),label:z.string(),priceAdjustment:z.number().finite().int()})).optional(),
}).passthrough().superRefine((value,context)=>{if(value.pricingMode==="per_area"&&(!value.widthMm||!value.heightMm))context.addIssue({code:"custom",message:"Area pricing requires width and height."});});
const schema=z.object({client:z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(200)}).passthrough(),
  sections:z.array(z.object({lines:z.array(line).min(1),kind:z.enum(["included","alternative"]).optional()}).passthrough()).min(1),
  currency:z.enum(["PHP","USD","EUR"]).optional(),vatMode:z.enum(["none","exclusive","inclusive"]).optional(),vatRate:z.number().finite().min(0).max(100).optional(),
  discountType:z.enum(["percent","fixed"]).optional(),discountPercent:z.number().finite().min(0).max(100).optional(),discountFixed:money.optional(),depositPercent:z.number().finite().min(0).max(100).optional(),
  extraCharges:z.array(z.object({label:z.string().trim().min(1),amount:money})).optional(),
}).passthrough();
export function validateDocumentDraft(value:unknown):DocumentDraft{return schema.parse(value) as DocumentDraft;}
