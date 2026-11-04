import { z } from "zod";

const shapeSchema = z.discriminatedUnion("t", [
  z.object({ id: z.string(), t: z.literal("rect"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), sym: z.enum(["none", "louver", "F", "L", "R", "LR", "awning", "tilt", "swingL", "swingR"]) }),
  z.object({ id: z.string(), t: z.literal("arch"), x: z.number(), y: z.number(), w: z.number(), h: z.number(), sym: z.enum(["none", "louver", "F", "L", "R", "LR", "awning", "tilt", "swingL", "swingR"]) }),
  z.object({ id: z.string(), t: z.literal("line"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
  z.object({ id: z.string(), t: z.literal("arrow"), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
  z.object({ id: z.string(), t: z.literal("text"), x: z.number(), y: z.number(), text: z.string(), size: z.number() }),
]);

export const designSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  widthMm: z.number().int().positive(),
  heightMm: z.number().int().positive(),
  shapes: z.array(shapeSchema),
  updatedAt: z.string(),
  unit: z.enum(["m", "mm", "ft"]).optional(),
  section: z.enum(["Windows", "Doors", "Others"]).optional(),
  type: z.string().optional(),
  series: z.string().optional(),
  spec: z.object({
    glassMm: z.number(), glassType: z.string(), frame: z.string(),
    hardware: z.string(), profileMm: z.number(), finish: z.string(),
  }).optional(),
});

