import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { SharpifyConfig } from "@prisma/client";

const CONFIG_ID = "default";

export class SharpifyConfigError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED"
  ) {
    super(message);
    this.name = "SharpifyConfigError";
  }
}

export async function getSharpifyConfig(): Promise<SharpifyConfig> {
  return prisma.sharpifyConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

/** Só diz SE tem credencial configurada — nunca devolve o client_secret em texto puro. */
export async function isSharpifyConfigured(): Promise<boolean> {
  const config = await getSharpifyConfig();
  return !!(config.clientId && config.clientSecretEncrypted);
}

export async function saveSharpifyConfig(input: { clientId: string; clientSecret: string }): Promise<void> {
  await prisma.sharpifyConfig.upsert({
    where: { id: CONFIG_ID },
    update: {
      clientId: input.clientId,
      clientSecretEncrypted: encryptSecret(input.clientSecret),
    },
    create: {
      id: CONFIG_ID,
      clientId: input.clientId,
      clientSecretEncrypted: encryptSecret(input.clientSecret),
    },
  });
}

export function getSharpifyCredentials(config: SharpifyConfig): { clientId: string; clientSecret: string } {
  if (!config.clientId || !config.clientSecretEncrypted) {
    throw new SharpifyConfigError("Sharpify não configurada.", "NOT_CONFIGURED");
  }
  return { clientId: config.clientId, clientSecret: decryptSecret(config.clientSecretEncrypted) };
}
