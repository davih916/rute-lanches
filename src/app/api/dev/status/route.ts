import { NextResponse } from "next/server";
import { verifyDevPassword } from "@/lib/dev-auth";
import { getSettings } from "@/lib/services/settings-service";
import { isSharpifyConfigured } from "@/lib/services/sharpify-config-service";
import { isMensalidadePagamentoConfigured } from "@/lib/services/mensalidade-payment-config-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/** Painel /admin/dev: devolve o estado atual (mensalidade + Sharpify de pedidos + Sharpify da mensalidade) depois de validar a senha. */
export async function POST(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:dev-status`, 10, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const auth = verifyDevPassword(password);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [settings, sharpifyConfigured, mensalidadePagamentoConfigured] = await Promise.all([
    getSettings(),
    isSharpifyConfigured(),
    isMensalidadePagamentoConfigured(),
  ]);

  return NextResponse.json({
    mensalidadePagaEm: settings.mensalidadePagaEm,
    mensalidadeReminderEnabled: settings.mensalidadeReminderEnabled,
    mensalidadeValorCents: settings.mensalidadeValorCents,
    mensalidadePagamentoConfigured,
    sharpifyConfigured,
  });
}
