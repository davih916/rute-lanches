import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { confirmMensalidadePaid } from "@/lib/services/settings-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Painel /admin/dev (uso exclusivo do desenvolvedor, não da loja): confirma
 * que a mensalidade do mês corrente foi paga, o que faz o banner de cobrança
 * sumir do dashboard admin até o próximo mês. Autenticado por senha própria
 * (DEV_PANEL_PASSWORD, variável de ambiente — nunca commitada), separada do
 * login da loja.
 */
export async function POST(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:dev-confirm-payment`, 5, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const expected = process.env.DEV_PANEL_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "DEV_PANEL_PASSWORD não configurada no servidor." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(password.padEnd(expectedBuf.length, "\0").slice(0, expectedBuf.length));
  const matches = password.length === expected.length && timingSafeEqual(expectedBuf, providedBuf);

  if (!matches) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const settings = await confirmMensalidadePaid();
  return NextResponse.json({ mensalidadePagaEm: settings.mensalidadePagaEm });
}
