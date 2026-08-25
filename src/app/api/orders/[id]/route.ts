import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/services/order-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Público: a tela /pedido/[id] usa isso pra re-consultar o status sozinha
 * (polling) — sem isso, a tela do cliente fica parada no que foi carregado
 * na primeira visita, mesmo que a loja avance o pedido no Kanban depois.
 * Não expõe nada que a própria página /pedido/[id] já não mostrasse.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:order-get`, 60, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
  }

  const order = await getOrderById(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ order });
}
