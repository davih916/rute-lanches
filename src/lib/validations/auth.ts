import { z } from "zod";

export const loginSchema = z.object({
  password: z.string().min(1, "Informe a senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres").max(72),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
