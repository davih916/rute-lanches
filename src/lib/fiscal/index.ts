import "server-only";
import { prisma } from "@/lib/prisma";
import { validateLocalFiscalCertificate } from "@/lib/services/fiscal-certificate-service";
import { getFiscalEnvConfig } from "./env-config";
import type { FiscalProvider } from "./fiscal-provider.interface";
import { PendingProvider } from "./providers/pending-provider";
import { NuvemFiscalProvider } from "./providers/nuvem-fiscal-provider";

export type { FiscalProvider, FiscalIssueInput, FiscalIssueResult, FiscalIssueItem } from "./fiscal-provider.interface";
export type { NuvemFiscalCompanyData } from "./providers/nuvem-fiscal-provider";
export { getFiscalEnvConfig } from "./env-config";

/**
 * Fábrica do provider fiscal ativo. Provider/ambiente/credenciais vêm do
 * ambiente (`getFiscalEnvConfig`); dados cadastrais da empresa vêm de
 * FiscalConfig (banco); o certificado A1 vem de um arquivo local no servidor
 * (`FISCAL_CERTIFICADO_PATH`/`FISCAL_CERTIFICADO_SENHA`), validado a cada
 * chamada para que um certificado ausente/expirado vire um erro amigável no
 * momento da emissão, não só um log no boot.
 *
 * Quando uma nova integração for adicionada (Focus NFe, PlugNotas...), basta:
 *   1. criar `providers/<nome>.provider.ts` implementando `FiscalProvider`;
 *   2. adicionar o `case` correspondente aqui.
 * Nenhum outro ponto do sistema precisa mudar.
 */
export async function getFiscalProvider(): Promise<FiscalProvider> {
  const env = getFiscalEnvConfig();

  if (env.provider === "pending") {
    return new PendingProvider();
  }

  if (env.provider === "nuvem_fiscal") {
    if (!env.clientId || !env.clientSecret) {
      return new PendingProvider(
        "Credenciais da Nuvem Fiscal não configuradas (NUVEM_FISCAL_CLIENT_ID/NUVEM_FISCAL_CLIENT_SECRET)."
      );
    }

    const config = await prisma.fiscalConfig.findUnique({ where: { id: "default" } });
    if (!config?.cnpj || !config.regimeTributario) {
      return new PendingProvider(
        "Dados cadastrais da empresa incompletos (CNPJ/regime tributário) — ver prisma/seed.ts."
      );
    }

    const certificate = await validateLocalFiscalCertificate();
    if (!certificate.ok) {
      return new PendingProvider(certificate.error);
    }
    if (!config.certificadoEnviadoEm) {
      return new PendingProvider(
        "Certificado digital A1 ainda não foi enviado ao provider fiscal — verifique os logs de inicialização da aplicação."
      );
    }

    return new NuvemFiscalProvider({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      ambiente: env.ambiente,
      cnpj: config.cnpj,
      regimeTributario:
        config.regimeTributario === "normal" || config.regimeTributario === "mei"
          ? config.regimeTributario
          : "simples_nacional",
    });
  }

  return new PendingProvider();
}
