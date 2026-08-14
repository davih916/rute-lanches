import { NextResponse } from "next/server";
import { cancelOrderByCustomer, OrderServiceError } from "@/lib/services/order-service";
import { checkRequestRateLimit, getClientIp } from "@/lib/rate-limit";

/** Público: o cliente cancela o próprio pedido pela tela /pedido/[id] (sem login — mesmo modelo de confiança da própria página, protegido só pelo id não-adivinhável). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rateLimit = checkRequestRateLimit(`${getClientIp(request)}:cancel-order`, 10, 60_000);
  if (rateLimit.blocked) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  try {
    const order = await cancelOrderByCustomer(id);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status = err.code === "ORDER_NOT_FOUND" ? 404 : err.code === "STATUS_CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao cancelar pedido:", err);
    return NextResponse.json({ error: "Erro ao cancelar pedido." }, { status: 500 });
  }
}
