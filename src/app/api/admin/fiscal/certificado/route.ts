import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadCertificateSchema } from "@/lib/validations/fiscal";
import { uploadCertificate, FiscalConfigServiceError } from "@/lib/services/fiscal-config-service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = formData.get("certificado");
  const password = formData.get("password");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecione o arquivo do certificado (.pfx)." }, { status: 400 });
  }
  if (!/\.(pfx|p12)$/i.test(file.name)) {
    return NextResponse.json({ error: "O arquivo deve ser um certificado .pfx ou .p12." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande." }, { status: 400 });
  }

  const parsedPassword = uploadCertificateSchema.safeParse({ password });
  if (!parsedPassword.success) {
    return NextResponse.json(
      { error: "Informe a senha do certificado.", details: parsedPassword.error.flatten() },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    await uploadCertificate(base64, parsedPassword.data.password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FiscalConfigServiceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Erro ao enviar certificado fiscal:", err);
    return NextResponse.json({ error: "Erro ao enviar certificado." }, { status: 500 });
  }
}
