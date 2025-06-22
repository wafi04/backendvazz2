import { z } from "zod";

export const methodschema = z.object({
  code: z.string().min(2, { message: "Code must be at least 2 characters" }),
  description: z.string(),
  maxExpired: z.number().positive().optional(),
  image: z.string(),
  minExpired: z.number().positive().optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  isActive: z.string(),
  type: z.string(),
  taxType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  taxAdmin: z.number().positive().optional(),
});

export type MethodSchemas = z.infer<typeof methodschema>;
