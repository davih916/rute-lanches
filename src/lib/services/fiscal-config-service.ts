import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import {
  NuvemFiscalProvider,
  type NuvemFiscalCredentials,
  type NuvemFiscalCompanyData,
} from "@/lib/fiscal/providers/nuvem-fiscal-provider";
import type { UpdateFiscalConfigInput } from "@/lib/validations/fiscal";
import type { FiscalConfig } from "@prisma/client";

const CONFIG_ID = "default";

export class FiscalConfigServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_CONFIGURED" | "PROVIDER_ERROR"
  ) {
    super(message);
    this.name = "FiscalConfigServiceError";
  }
}

export async function getFiscalConfig(): Promise<FiscalConfig> {
  return prisma.fiscalConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

export type FiscalConfigForAdmin = Omit<FiscalConfig, "clientSecretEncrypted"> & {
  hasClientSecret: boolean;
};

/** Nunca retorna o client_secret em texto puro — só um indicador de que existe um. */
export async function getFiscalConfigForAdmin(): Promise<FiscalConfigForAdmin> {
  const config = await getFiscalConfig();
  const { clientSecretEncrypted, ...safe } = config;
  return { ...safe, hasClientSecret: !!clientSecretEncrypted };
}

export async function updateFiscalConfig(input: UpdateFiscalConfigInput): Promise<FiscalConfigForAdmin> {
  const current = await getFiscalConfig();
  const clientSecretEncrypted = input.clientSecret
    ? encryptSecret(input.clientSecret)
    : current.clientSecretEncrypted;

  const updated = await prisma.fiscalConfig.update({
    where: { id: CONFIG_ID },
    data: {
      provider: input.provider,
      ambiente: input.ambiente,
      clientId: input.clientId || null,
      clientSecretEncrypted,
      cnpj: input.cnpj,
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia || null,
      inscricaoEstadual: input.inscricaoEstadual,
      inscricaoMunicipal: input.inscricaoMunicipal || null,
      regimeTributario: input.regimeTributario,
      email: input.email,
      telefone: input.telefone || null,
      logradouro: input.logradouro,
      numero: input.numero,
      complemento: input.complemento || null,
      bairro: input.bairro,
      municipioCodigo: input.municipioCodigo,
      municipioNome: input.municipioNome,
      uf: input.uf,
      cep: input.cep,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clientSecretEncrypted: _omit, ...safe } = updated;
  return { ...safe, hasClientSecret: !!updated.clientSecretEncrypted };
}

function buildProviderFromConfig(config: FiscalConfig): NuvemFiscalProvider {
  if (!config.clientId || !config.clientSecretEncrypted || !config.cnpj) {
    throw new FiscalConfigServiceError(
      "Preencha o provider, as credenciais e o CNPJ antes de continuar.",
      "NOT_CONFIGURED"
    );
  }

  const credentials: NuvemFiscalCredentials = {
    clientId: config.clientId,
    clientSecret: decryptSecret(config.clientSecretEncrypted),
    ambiente: config.ambiente === "producao" ? "producao" : "homologacao",
    cnpj: config.cnpj,
    regimeTributario:
      config.regimeTributario === "normal" || config.regimeTributario === "mei"
        ? config.regimeTributario
        : "simples_nacional",
  };

  return new NuvemFiscalProvider(credentials);
}

/** Cadastra (ou atualiza) a empresa emitente no provider fiscal. Chamado a partir da tela de Configurações → Fiscal. */
export async function registerCompanyWithProvider(): Promise<void> {
  const config = await getFiscalConfig();

  if (
    !config.razaoSocial ||
    !config.inscricaoEstadual ||
    !config.email ||
    !config.logradouro ||
    !config.numero ||
    !config.bairro ||
    !config.municipioCodigo ||
    !config.uf ||
    !config.cep
  ) {
    throw new FiscalConfigServiceError(
      "Preencha todos os dados da empresa (endereço completo incluído) antes de cadastrar.",
      "NOT_CONFIGURED"
    );
  }

  const provider = buildProviderFromConfig(config);

  const companyData: NuvemFiscalCompanyData = {
    cnpj: config.cnpj!,
    razaoSocial: config.razaoSocial,
    nomeFantasia: config.nomeFantasia,
    email: config.email,
    inscricaoEstadual: config.inscricaoEstadual,
    inscricaoMunicipal: config.inscricaoMunicipal,
    logradouro: config.logradouro,
    numero: config.numero,
    complemento: config.complemento,
    bairro: config.bairro,
    municipioCodigo: config.municipioCodigo,
    uf: config.uf,
    cep: config.cep,
    telefone: config.telefone,
  };

  try {
    await provider.ensureCompanyRegistered(companyData);
  } catch (err) {
    throw new FiscalConfigServiceError(
      err instanceof Error ? err.message : "Erro ao cadastrar empresa no provider fiscal.",
      "PROVIDER_ERROR"
    );
  }

  await prisma.fiscalConfig.update({
    where: { id: CONFIG_ID },
    data: { empresaRegistradaEm: new Date() },
  });
}

/** Envia o certificado A1 (.pfx em base64 + senha) para o provider fiscal. */
export async function uploadCertificate(pfxBase64: string, password: string): Promise<void> {
  const config = await getFiscalConfig();
  const provider = buildProviderFromConfig(config);

  let result: { validoAte?: string };
  try {
    result = await provider.uploadCertificado(config.cnpj!, pfxBase64, password);
  } catch (err) {
    throw new FiscalConfigServiceError(
      err instanceof Error ? err.message : "Erro ao enviar certificado digital.",
      "PROVIDER_ERROR"
    );
  }

  await prisma.fiscalConfig.update({
    where: { id: CONFIG_ID },
    data: {
      certificadoEnviadoEm: new Date(),
      certificadoValidoAte: result.validoAte ? new Date(result.validoAte) : null,
    },
  });
}
