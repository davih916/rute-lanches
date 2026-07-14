import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { UpdatePagBankConfigInput } from "@/lib/validations/pagbank";
import type { PagBankConfig } from "@prisma/client";

const CONFIG_ID = "default";

export class PagBankConfigServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "CONNECTION_ERROR"
  ) {
    super(message);
    this.name = "PagBankConfigServiceError";
  }
}

export async function getPagBankConfig(): Promise<PagBankConfig> {
  return prisma.pagBankConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

export type PagBankConfigForAdmin = Omit<PagBankConfig, "clientSecretEncrypted" | "tokenEncrypted"> & {
  hasClientSecret: boolean;
  hasToken: boolean;
};

/** Nunca retorna client_secret/token em texto puro — só um indicador de que existem. */
export async function getPagBankConfigForAdmin(): Promise<PagBankConfigForAdmin> {
  const config = await getPagBankConfig();
  const { clientSecretEncrypted, tokenEncrypted, ...safe } = config;
  return { ...safe, hasClientSecret: !!clientSecretEncrypted, hasToken: !!tokenEncrypted };
}

export async function updatePagBankConfig(
  input: UpdatePagBankConfigInput
): Promise<PagBankConfigForAdmin> {
  const current = await getPagBankConfig();
  const clientSecretEncrypted = input.clientSecret
    ? encryptSecret(input.clientSecret)
    : current.clientSecretEncrypted;
  const tokenEncrypted = input.token ? encryptSecret(input.token) : current.tokenEncrypted;

  const updated = await prisma.pagBankConfig.update({
    where: { id: CONFIG_ID },
    data: {
      ambiente: input.ambiente,
      clientId: input.clientId || null,
      clientSecretEncrypted,
      tokenEncrypted,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientSecretEncrypted: _omitA, tokenEncrypted: _omitB, ...safe } = updated;
  return { ...safe, hasClientSecret: !!updated.clientSecretEncrypted, hasToken: !!updated.tokenEncrypted };
}

export function getPagBankBaseUrl(config: Pick<PagBankConfig, "ambiente">): string {
  return config.ambiente === "producao"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

export function getPagBankToken(config: PagBankConfig): string {
  if (!config.tokenEncrypted) {
    throw new PagBankConfigServiceError(
      "Configure o token do PagBank antes de continuar.",
      "NOT_CONFIGURED"
    );
  }
  return decryptSecret(config.tokenEncrypted);
}

/** Testa a conexão com o PagBank fazendo uma consulta autenticada simples. */
export async function testPagBankConnection(): Promise<void> {
  const config = await getPagBankConfig();
  const token = getPagBankToken(config);
  const baseUrl = getPagBankBaseUrl(config);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/orders?page_size=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (err) {
    throw new PagBankConfigServiceError(
      err instanceof Error ? err.message : "Erro de conexão com o PagBank.",
      "CONNECTION_ERROR"
    );
  }

  if (!response.ok) {
    throw new PagBankConfigServiceError(
      `PagBank recusou as credenciais (HTTP ${response.status}). Confira o token.`,
      "CONNECTION_ERROR"
    );
  }

  await prisma.pagBankConfig.update({ where: { id: CONFIG_ID }, data: { testadoEm: new Date() } });
}
