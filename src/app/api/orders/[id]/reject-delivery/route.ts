import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rejectDeliverySchema } from "@/lib/validations/order";
import { rejectDelivery, OrderServiceError } from "@/lib/services/order-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = rejectDeliverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  }

  try {
    const order = await rejectDelivery(id, parsed.data.reason, session.sub);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status = err.code === "STATUS_CONFLICT" ? 409 : err.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao recusar entrega:", err);
    return NextResponse.json({ error: "Erro ao recusar entrega." }, { status: 500 });
  }
}
