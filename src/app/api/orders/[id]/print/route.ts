import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markOrderPrinted, OrderServiceError } from "@/lib/services/order-service";

/** Marca o pedido como impresso (idempotente). Chamado pela página da comanda. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await markOrderPrinted(id);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Erro ao marcar pedido como impresso:", err);
    return NextResponse.json({ error: "Erro ao marcar impressão." }, { status: 500 });
  }
}
