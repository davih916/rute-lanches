import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPixChargePaid, markPixChargePaid } from "@/lib/services/pagbank-service";

/**
 * Webhook do PagBank (sem sessão — é o PagBank chamando). Não confiamos no
 * status que vier no corpo da notificação: usamos o id recebido só para achar
 * a cobrança e então confirmamos o status de verdade direto na API do PagBank
 * (server-to-server) antes de marcar como pago.
 */
export async function POST(request: Request) {
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
