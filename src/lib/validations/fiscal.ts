import { z } from "zod";

const digitsOnly = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= min && v.length <= max, message);

export const updateProductFiscalSchema = z.object({
  ncm: digitsOnly(8, 8, "NCM inválido (8 dígitos)"),
  cfop: digitsOnly(4, 4, "CFOP inválido (4 dígitos)"),
  csosnCst: digitsOnly(2, 3, "CSOSN/CST inválido (2 ou 3 dígitos)"),
  unidadeComercial: z.string().trim().min(1).max(6).toUpperCase(),
});

export type UpdateProductFiscalInput = z.infer<typeof updateProductFiscalSchema>;
