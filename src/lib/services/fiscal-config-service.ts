import "server-only";
import { prisma } from "@/lib/prisma";
import {
  NuvemFiscalProvider,
  type NuvemFiscalCredentials,
  type NuvemFiscalCompanyData,
} from "@/lib/fiscal/providers/nuvem-fiscal-provider";
import { getFiscalEnvConfig } from "@/lib/fiscal/env-config";
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

/** Dados cadastrais da empresa emitente (CNPJ, endereço, CNAE...) — ver prisma/seed.ts para editar. */
export async function getFiscalConfig(): Promise<FiscalConfig> {
  return prisma.fiscalConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: { id: CONFIG_ID },
  });
}

function buildProviderFromConfig(config: FiscalConfig): NuvemFiscalProvider {
  const env = getFiscalEnvConfig();
  if (!env.clientId || !env.clientSecret || !config.cnpj) {
    throw new FiscalConfigServiceError(
      "Credenciais da Nuvem Fiscal (env) ou CNPJ da empresa (FiscalConfig) ausentes.",
      "NOT_CONFIGURED"
    );
  }

  const credentials: NuvemFiscalCredentials = {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    ambiente: env.ambiente,
    cnpj: config.cnpj,
    regimeTributario:
      config.regimeTributario === "normal" || config.regimeTributario === "mei"
        ? config.regimeTributario
        : "simples_nacional",
  };

  return new NuvemFiscalProvider(credentials);
}

/** Cadastra (ou atualiza) a empresa emitente no provider fiscal. Chamado automaticamente no boot — ver fiscal-certificate-service.ts. */
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
      "Preencha todos os dados da empresa (endereço completo incluído) antes de cadastrar — ver prisma/seed.ts.",
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

/** Envia o certificado A1 (.pfx em base64 + senha) para o provider fiscal. Chamado automaticamente no boot. */
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
