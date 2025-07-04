import z from "zod";
export const passwordSchema = z
  .string()
  .min(5, { message: "Password must be at least 5 characters long." });

export const loginSchema = z.object({
  username: z.string(),
  password: passwordSchema,
});

export const registerSchema = z.object({
  username: z.string(),
  name: z.string(),
  whatsapp: z.number(),
  password: passwordSchema,
});

export const updateUser = z.object({
  username: z.string(),
  name: z.string(),
  whatsapp: z.number(),
});

export const updatePasswordSchema  =z.object({
  oldPassword : passwordSchema,
  newPassword : passwordSchema
})
export type loginAuth = z.infer<typeof loginSchema>;
export type RegisterAuth = z.infer<typeof registerSchema>;
export type UpdateUser = z.infer<typeof updateUser>;
