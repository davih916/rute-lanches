/**
 * Roda uma vez quando o servidor Next.js inicia (App Router — ver
 * https://nextjs.org/docs/app/guides/instrumentation). Usado aqui só para
 * validar o certificado fiscal A1 local e garantir que ele esteja registrado
 * no provider fiscal, sem precisar de nenhuma ação manual no painel admin.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureFiscalCertificateUploaded } = await import(
    "@/lib/services/fiscal-certificate-service"
  );
  await ensureFiscalCertificateUploaded();
}
