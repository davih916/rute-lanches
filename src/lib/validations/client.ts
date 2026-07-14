import { z } from "zod";

export const clientLoginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export const clientPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres.").max(72),
});

export const clientProfileSchema = z.object({
  empresaNome: z.string().trim().min(2, "Informe o nome da empresa."),
  telefone: z.string().trim().optional().nullable(),
  logradouro: z.string().trim().optional().nullable(),
  numero: z.string().trim().optional().nullable(),
  complemento: z.string().trim().optional().nullable(),
  bairro: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  uf: z.string().trim().max(2).optional().nullable(),
  cep: z.string().trim().optional().nullable(),
});
