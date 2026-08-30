import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { MensalidadePagamentoConfig } from "@prisma/client";

const CONFIG_ID = "default";

export class MensalidadePagamentoConfigError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED"
  ) {
    super(message);
    this.name = "MensalidadePagamentoConfigError";
  }
}

export async function getMensalidadePagamentoConfig(): Promise<MensalidadePagamentoConfig> {
  return prisma.mensalidadePagamentoConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

export async function isMensalidadePagamentoConfigured(): Promise<boolean> {
  const config = await getMensalidadePagamentoConfig();
  return !!(config.clientId && config.clientSecretEncrypted);
}

export async function saveMensalidadePagamentoConfig(input: {
  clientId: string;
  clientSecret: string;
}): Promise<void> {
  await prisma.mensalidadePagamentoConfig.upsert({
    where: { id: CONFIG_ID },
    update: { clientId: input.clientId, clientSecretEncrypted: encryptSecret(input.clientSecret) },
    create: {
      id: CONFIG_ID,
      clientId: input.clientId,
      clientSecretEncrypted: encryptSecret(input.clientSecret),
    },
  });
}

export function getMensalidadePagamentoCredentials(
  config: MensalidadePagamentoConfig
): { clientId: string; clientSecret: string } {
  if (!config.clientId || !config.clientSecretEncrypted) {
    throw new MensalidadePagamentoConfigError("Pagamento da mensalidade não configurado.", "NOT_CONFIGURED");
  }
  return { clientId: config.clientId, clientSecret: decryptSecret(config.clientSecretEncrypted) };
}
