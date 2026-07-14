import { z } from "zod";
import { PAGBANK_AMBIENTES } from "@/lib/constants";

export const updatePagBankConfigSchema = z.object({
  ambiente: z.enum(PAGBANK_AMBIENTES),
  clientId: z.string().trim().max(200).optional().or(z.literal("")),
  // Só enviados quando o admin quer TROCAR o valor; vazio = mantém o atual.
  clientSecret: z.string().trim().max(500).optional().or(z.literal("")),
  token: z.string().trim().max(500).optional().or(z.literal("")),
});

export type UpdatePagBankConfigInput = z.infer<typeof updatePagBankConfigSchema>;
