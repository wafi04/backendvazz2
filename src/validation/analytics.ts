import z from "zod";

export const analyticsQuerySchema = z.object({
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid start date format"
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid end date format"
  }),
  transactionType: z.enum(['TOPUP', 'DEPOSIT', 'MEMBERSHIP']).optional(),
  status: z.string().optional(),
  username: z.string().optional(),
  limit: z.string().transform(Number).optional().default('10')
});