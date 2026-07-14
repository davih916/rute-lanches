import "server-only";
import { readFile } from "node:fs/promises";
import forge from "node-forge";
import {
  getFiscalConfig,
  registerCompanyWithProvider,
  uploadCertificate,
} from "@/lib/services/fiscal-config-service";

const WARN_DAYS_BEFORE_EXPIRY = 30;

export type CertificateValidation =
  | { ok: true; expiresAt: Date; expiringSoon: boolean }
  | { ok: false; error: string };

function getCertificatePath(): string | null {
  return process.env.FISCAL_CERTIFICADO_PATH || null;
}

function getCertificatePassword(): string | null {
  return process.env.FISCAL_CERTIFICADO_SENHA || null;
}

/**
 * Lê e valida o certificado A1 local (existe, senha correta, dentro da
 * validade). Nunca lança — sempre devolve um resultado com mensagem amigável.
 * Usado tanto no boot da aplicação (instrumentation.ts) quanto na hora de
 * montar o provider fiscal (src/lib/fiscal/index.ts), para o erro aparecer
 * também quando alguém tenta emitir uma nota, não só no log de inicialização.
 */
export async function validateLocalFiscalCertificate(): Promise<CertificateValidation> {
  const path = getCertificatePath();
  const password = getCertificatePassword();

  if (!path || !password) {
    return {
      ok: false,
      error:
        "Certificado A1 não configurado. Defina FISCAL_CERTIFICADO_PATH e FISCAL_CERTIFICADO_SENHA no .env.",
    };
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(path);
  } catch {
    return { ok: false, error: `Certificado não encontrado em "${path}".` };
  }

  try {
    const base64 = fileBuffer.toString("base64");
    const der = forge.util.decode64(base64);
    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    const cert = certBag?.cert;
    if (!cert) {
      return { ok: false, error: "Certificado inválido: nenhum certificado encontrado no arquivo." };
    }

    const expiresAt = cert.validity.notAfter;
    if (expiresAt.getTime() < Date.now()) {
      return {
        ok: false,
        error: `Certificado expirado em ${expiresAt.toLocaleDateString("pt-BR")}. Envie um certificado novo.`,
      };
    }

    const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return { ok: true, expiresAt, expiringSoon: daysUntilExpiry <= WARN_DAYS_BEFORE_EXPIRY };
  } catch {
    // node-forge lança um erro genérico tanto para senha errada quanto para
    // arquivo corrompido/não-PKCS12 — não dá pra distinguir com segurança.
    return { ok: false, error: "Certificado inválido ou senha incorreta." };
  }
}

/**
 * Garante que o certificado local (se válido) esteja registrado no provider
 * fiscal (Nuvem Fiscal). Só reenvia se ainda não tiver sido enviado nesta
 * instalação — chamada uma vez no boot da aplicação, nunca a cada emissão.
 */
export async function ensureFiscalCertificateUploaded(): Promise<void> {
  const validation = await validateLocalFiscalCertificate();
  if (!validation.ok) {
    console.warn(`[fiscal] ${validation.error}`);
    return;
  }
  if (validation.expiringSoon) {
    console.warn(
      `[fiscal] Certificado A1 vence em ${validation.expiresAt.toLocaleDateString("pt-BR")} — providencie a renovação.`
    );
  }

  const config = await getFiscalConfig();
  const alreadyUploaded =
    config.certificadoEnviadoEm &&
    config.certificadoValidoAte?.getTime() === validation.expiresAt.getTime();
  if (alreadyUploaded) {
    return;
  }

  try {
    if (!config.empresaRegistradaEm) {
      await registerCompanyWithProvider();
    }

    const path = getCertificatePath()!;
    const password = getCertificatePassword()!;
    const base64 = (await readFile(path)).toString("base64");
    await uploadCertificate(base64, password);
    console.log("[fiscal] Certificado A1 enviado ao provider fiscal com sucesso.");
  } catch (err) {
    console.error(
      "[fiscal] Falha ao enviar o certificado A1 ao provider fiscal:",
      err instanceof Error ? err.message : err
    );
  }
}
