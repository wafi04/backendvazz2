import { z } from "zod";

export const newsSchema = z.object({
  path: z.string(),
  isActive: z.string().default("isactive"),
  type: z.string().default("banner"),
  description: z.string().default("description"),
});

export type newsCreateSchema = z.infer<typeof newsSchema>;
export type newsUpdateSchema = z.infer<typeof newsSchema>;
