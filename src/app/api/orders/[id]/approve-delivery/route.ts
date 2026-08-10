import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { approveDeliverySchema } from "@/lib/validations/order";
import { approveDelivery, OrderServiceError } from "@/lib/services/order-service";

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
    const order = await approveDelivery(id, parsed.data.feeCents, session.sub);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status = err.code === "STATUS_CONFLICT" ? 409 : err.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao aprovar entrega:", err);
    return NextResponse.json({ error: "Erro ao aprovar entrega." }, { status: 500 });
  }
}
