import { NextResponse } from "next/server";
import { verifyDevPassword } from "@/lib/dev-auth";
import { saveMensalidadePagamentoConfig } from "@/lib/services/mensalidade-payment-config-service";
import { setMensalidadeValorCents } from "@/lib/services/settings-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Painel /admin/dev: salva as credenciais (criptografadas) usadas SÓ pra
 * cobrar a mensalidade via Pix, e o valor da mensalidade — totalmente
 * separado das credenciais usadas nos pedidos da loja (SharpifyConfig).
 */
export async function POST(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:dev-mensalidade-payment-config`, 10, 60_000);
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
  const valorReais = typeof body?.valorReais === "string" ? body.valorReais.trim() : "";

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Preencha client ID e client secret." }, { status: 400 });
  }

  const valorCents = Math.round(parseFloat(valorReais.replace(",", ".")) * 100);
  if (!Number.isFinite(valorCents) || valorCents <= 0) {
    return NextResponse.json({ error: "Informe um valor de mensalidade válido." }, { status: 400 });
  }

  await saveMensalidadePagamentoConfig({ clientId, clientSecret });
  await setMensalidadeValorCents(valorCents);

  return NextResponse.json({ ok: true });
}
