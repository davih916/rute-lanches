import { NextResponse } from "next/server";
import { verifyDevPassword } from "@/lib/dev-auth";
import { saveSharpifyConfig } from "@/lib/services/sharpify-config-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/** Painel /admin/dev: salva as credenciais da Sharpify (criptografadas) — usadas só pra gerar/consultar cobrança Pix dos pedidos. */
export async function POST(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:dev-sharpify-config`, 10, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const auth = verifyDevPassword(password);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Preencha client ID e client secret." }, { status: 400 });
  }

  await saveSharpifyConfig({ clientId, clientSecret });
  return NextResponse.json({ ok: true });
}
