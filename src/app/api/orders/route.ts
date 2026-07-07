import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createOrderSchema } from "@/lib/validations/order";
import { createOrder, listOrders, OrderServiceError } from "@/lib/services/order-service";

/** Público: o cliente do site cria um pedido. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados do pedido inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(parsed.data);
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status =
        err.code === "STORE_CLOSED" ||
        err.code === "PAYMENT_METHOD_DISABLED" ||
        err.code === "DELIVERY_ZONE_UNAVAILABLE"
          ? 409
          : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao criar pedido:", err);
    return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 });
  }
}

/** Protegido: painel administrativo lista os pedidos. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const orders = await listOrders();
  return NextResponse.json({ orders });
}
