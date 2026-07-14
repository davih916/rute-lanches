import { z } from "zod";
import { FISCAL_PROVIDERS, FISCAL_AMBIENTES, REGIMES_TRIBUTARIOS } from "@/lib/constants";

const digitsOnly = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= min && v.length <= max, message);

export const updateFiscalConfigSchema = z.object({
  provider: z.enum(FISCAL_PROVIDERS),
  ambiente: z.enum(FISCAL_AMBIENTES),
  clientId: z.string().trim().max(200).optional().or(z.literal("")),
  // Só enviado quando o admin quer TROCAR o secret; vazio = mantém o atual.
  clientSecret: z.string().trim().max(500).optional().or(z.literal("")),
  cnpj: digitsOnly(14, 14, "CNPJ inválido (deve ter 14 dígitos)"),
  razaoSocial: z.string().trim().min(2).max(200),
  nomeFantasia: z.string().trim().max(200).optional().or(z.literal("")),
  inscricaoEstadual: z.string().trim().min(1, "Informe a inscrição estadual").max(30),
  inscricaoMunicipal: z.string().trim().max(30).optional().or(z.literal("")),
  regimeTributario: z.enum(REGIMES_TRIBUTARIOS),
  email: z.string().trim().email("E-mail inválido"),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  cnaePrincipal: z.string().trim().max(20).optional().or(z.literal("")),
  cnaeDescricao: z.string().trim().max(200).optional().or(z.literal("")),
  logradouro: z.string().trim().min(2).max(200),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(120).optional().or(z.literal("")),
  bairro: z.string().trim().min(1).max(120),
  municipioCodigo: digitsOnly(7, 7, "Código IBGE do município inválido (7 dígitos)"),
  municipioNome: z.string().trim().min(1).max(120),
  uf: z
    .string()
    .trim()
    .length(2, "UF inválida")
    .transform((v) => v.toUpperCase()),
  cep: digitsOnly(8, 8, "CEP inválido (8 dígitos)"),
});

export type UpdateFiscalConfigInput = z.infer<typeof updateFiscalConfigSchema>;

export const uploadCertificateSchema = z.object({
  password: z.string().min(1, "Informe a senha do certificado"),
});

export const updateProductFiscalSchema = z.object({
  ncm: digitsOnly(8, 8, "NCM inválido (8 dígitos)"),
  cfop: digitsOnly(4, 4, "CFOP inválido (4 dígitos)"),
  csosnCst: digitsOnly(2, 3, "CSOSN/CST inválido (2 ou 3 dígitos)"),
  unidadeComercial: z.string().trim().min(1).max(6).toUpperCase(),
});

export type UpdateProductFiscalInput = z.infer<typeof updateProductFiscalSchema>;
