import { NextResponse } from "next/server";
import { verifyDevPassword } from "@/lib/dev-auth";
import { setMensalidadeReminderEnabled } from "@/lib/services/settings-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/** Painel /admin/dev: liga/desliga o banner de cobrança de mensalidade, independente do dia do mês. */
export async function POST(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:dev-mensalidade-toggle`, 10, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const auth = verifyDevPassword(password);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const enabled = body?.enabled === true;
  const settings = await setMensalidadeReminderEnabled(enabled);
  return NextResponse.json({ mensalidadeReminderEnabled: settings.mensalidadeReminderEnabled });
}
