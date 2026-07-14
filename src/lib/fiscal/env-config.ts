import "server-only";

/**
 * Credenciais da API do provider fiscal — vêm de variáveis de ambiente (não
 * mais do painel admin, ver HANDOFF.md). Arquivo isolado (sem outros imports
 * do módulo fiscal) para não criar dependência circular entre
 * src/lib/fiscal/index.ts e src/lib/services/fiscal-config-service.ts.
 */
export function getFiscalEnvConfig() {
  return {
    provider: process.env.FISCAL_PROVIDER || "pending",
    ambiente: process.env.FISCAL_AMBIENTE === "producao" ? ("producao" as const) : ("homologacao" as const),
    clientId: process.env.NUVEM_FISCAL_CLIENT_ID || null,
    clientSecret: process.env.NUVEM_FISCAL_CLIENT_SECRET || null,
  };
}
