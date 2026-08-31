import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveDeliverySchema } from "@/lib/validations/order";
import { setDeliveryFee, OrderServiceError } from "@/lib/services/order-service";

/**
 * Corrige/define a taxa de entrega depois da aprovação inicial (ex: pedido
 * saiu com taxa R$0,00 por engano). Ao contrário de approve-delivery, não
 * exige status "recebido" — usado pelo Kanban pra liberar o Pix quando
 * `deliveryFeeConfirmed` ficou false (ver getOrCreatePixCharge).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = approveDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Taxa de entrega inválida." }, { status: 400 });
  }

  try {
    const order = await setDeliveryFee(id, parsed.data.feeCents, session.sub);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status = err.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao definir taxa de entrega:", err);
    return NextResponse.json({ error: "Erro ao definir taxa de entrega." }, { status: 500 });
  }
}
