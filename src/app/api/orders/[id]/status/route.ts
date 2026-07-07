import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateOrderStatusSchema } from "@/lib/validations/order";
import { updateOrderStatus, OrderServiceError } from "@/lib/services/order-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(id, parsed.data.status, session.sub);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Erro ao atualizar status do pedido:", err);
    return NextResponse.json({ error: "Erro ao atualizar status." }, { status: 500 });
  }
}
