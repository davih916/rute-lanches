import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import type { FiscalProvider } from "./fiscal-provider.interface";
import { PendingProvider } from "./providers/pending-provider";
import { NuvemFiscalProvider } from "./providers/nuvem-fiscal-provider";

export type { FiscalProvider, FiscalIssueInput, FiscalIssueResult, FiscalIssueItem } from "./fiscal-provider.interface";
export type { NuvemFiscalCompanyData } from "./providers/nuvem-fiscal-provider";

/**
 * Fábrica do provider fiscal ativo, lida a partir de FiscalConfig (banco).
 * Cada lanchonete configura o próprio provider pelo painel — nada fica preso
 * a variáveis de ambiente, o que mantém o sistema replicável.
 *
 * Quando uma nova integração for adicionada (Focus NFe, PlugNotas...), basta:
 *   1. criar `providers/<nome>.provider.ts` implementando `FiscalProvider`;
 *   2. adicionar o `case` correspondente aqui.
 * Nenhum outro ponto do sistema precisa mudar.
 */
export async function getFiscalProvider(): Promise<FiscalProvider> {
  const config = await prisma.fiscalConfig.findUnique({ where: { id: "default" } });

  if (!config || config.provider === "pending") {
    return new PendingProvider();
  }

  if (config.provider === "nuvem_fiscal") {
    if (!config.clientId || !config.clientSecretEncrypted) {
      return new PendingProvider(
        "Credenciais da Nuvem Fiscal não configuradas. Preencha client_id e client_secret em Configurações → Fiscal."
      );
    }
    if (!config.cnpj || !config.regimeTributario) {
      return new PendingProvider(
        "Dados da empresa incompletos. Preencha CNPJ e regime tributário em Configurações → Fiscal."
      );
    }
    if (!config.certificadoEnviadoEm) {
      return new PendingProvider(
        "Certificado digital A1 ainda não foi enviado. Envie o certificado em Configurações → Fiscal."
      );
    }

    return new NuvemFiscalProvider({
      clientId: config.clientId,
      clientSecret: decryptSecret(config.clientSecretEncrypted),
      ambiente: config.ambiente as "homologacao" | "producao",
      cnpj: config.cnpj,
      regimeTributario: config.regimeTributario as "simples_nacional" | "normal" | "mei",
    });
  }

  return new PendingProvider();
}
