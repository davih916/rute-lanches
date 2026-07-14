import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPixChargePaid, markPixChargePaid } from "@/lib/services/pagbank-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Webhook do PagBank (sem sessão — é o PagBank chamando). Não confiamos no
 * status que vier no corpo da notificação: usamos o id recebido só para achar
 * a cobrança e então confirmamos o status de verdade direto na API do PagBank
 * (server-to-server) antes de marcar como pago.
 *
 * IMPORTANTE: o PagBank não está validando aqui se a chamada realmente veio
 * dele (não há verificação de assinatura/segredo compartilhado — ver
 * HANDOFF.md). Isso não permite marcar pedidos como pagos indevidamente
 * (a confirmação real é sempre feita de volta na API do PagBank), mas permite
 * que qualquer um chame essa rota repetidamente; o rate limit abaixo é uma
 * mitigação, não uma autenticação de verdade.
 */
export async function POST(request: Request) {
  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:pagbank-webhook`, 30, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ ok: true }, { status: 429 });
  }

  const rawBody = await request.text();

  let data: { id?: string; reference_id?: string } | null = null;
  try {
    data = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const externalId = data?.id;
  const orderId = data?.reference_id;

  if (!externalId && !orderId) {
    return NextResponse.json({ ok: true });
  }

  try {
    const charge = await prisma.pixCharge.findFirst({
      where: externalId ? { externalId } : { orderId },
    });

    if (!charge || charge.status === "pago" || !charge.externalId) {
      return NextResponse.json({ ok: true });
    }

    const paid = await confirmPixChargePaid(charge.externalId);
    if (paid) {
      await markPixChargePaid(charge.orderId);
    }
  } catch (err) {
    console.error("Erro ao processar webhook do PagBank:", err);
  }

  return NextResponse.json({ ok: true });
}
