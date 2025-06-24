import { z } from "zod";

export const createVoucherSchema = z.object({
  code: z
    .string()
    .min(1, "Voucher code is required")
    .max(50, "Voucher code must be 50 characters or less"),
  discountType: z
    .string()
    .min(1, "Discount type is required")
    .max(20, "Discount type must be 20 characters or less"),
  discountValue: z.number().positive("Discount value must be greater than 0"),
  maxDiscount: z
    .number()
    .positive("Maximum discount must be greater than 0")
    .optional()
    .nullable(),
  minPurchase: z
    .number()
    .positive("Minimum purchase must be greater than 0")
    .optional()
    .nullable(),
  usageLimit: z
    .number()
    .int()
    .positive("Usage limit must be a positive integer")
    .optional()
    .nullable(),
  usageCount: z
    .number()
    .int()
    .nonnegative("Usage count must be a non-negative integer")
    .optional()
    .default(0),
  // Sesuaikan dengan schema Prisma yang menggunakan String
  isForAllCategories: z
    .boolean()
    .transform((val) => (val ? "active" : "inactive"))
    .or(z.enum(["active", "inactive"]))
    .default("inactive"),
  // Sesuaikan dengan schema Prisma yang menggunakan String
  isActive: z
    .boolean()
    .transform((val) => (val ? "active" : "inactive"))
    .or(z.enum(["active", "inactive"]))
    .default("active"),
  startDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val))
    .optional(), // Optional karena ada default(now()) di Prisma
  expiryDate: z
    .string()
    .or(z.date())
    .transform((val) => new Date(val)),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable(),
  // Tambahan untuk relasi categories jika diperlukan
  categoryIds: z.array(z.number().int().positive()).optional().default([]),
});

// Schema untuk update voucher
export const updateVoucherSchema = createVoucherSchema.partial().extend({
  id: z.number().int().positive(),
});

// Schema untuk validasi voucher code
export const validateVoucherSchema = z.object({
  code: z.string().min(1, "Voucher code is required"),
  orderId: z.string().optional(),
  username: z.string().optional(),
  whatsapp: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  categoryId: z.number().int().positive().optional(),
});

// Type definitions based on Zod schemas
export type VoucherValidation = z.infer<typeof createVoucherSchema>;
export type UpdateVoucherValidation = z.infer<typeof updateVoucherSchema>;
export type ValidateVoucherInput = z.infer<typeof validateVoucherSchema>;
