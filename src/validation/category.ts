import { z } from "zod";

export const FormCategory = z.object({
  name: z.string().min(1, { message: "Nama kategori wajib diisi" }),
  subName: z.string().min(1, { message: "Sub nama wajib diisi" }),
  brand: z.string().min(1, { message: "Brand wajib diisi" }),
  code: z.string().optional(),
  status: z.string().min(1, { message: "Status wajib diisi" }),
  thumbnail: z.string().min(1, { message: "Thumbnail wajib diisi" }),
  type: z.string().min(1, { message: "Tipe wajib diisi" }),
  instruction: z.string().optional(),
  information: z.string().optional(),
  isCheckNickname: z.string(),
  placeholder1: z.string().min(1, { message: "Placeholder 1 wajib diisi" }),
  placeholder2: z.string().min(1, { message: "Placeholder 2 wajib diisi" }),
  banner: z.string().min(1, { message: "Banner layanan wajib diisi" }),
});

export const FormSubCategory = z.object({
  name: z.string(),
  categoryId: z.number(),
  code: z.string(),
  isActive: z.string(),
});

export type FormValuesSubCategory = z.infer<typeof FormSubCategory>;
export type FormValuesCategory = z.infer<typeof FormCategory>;
