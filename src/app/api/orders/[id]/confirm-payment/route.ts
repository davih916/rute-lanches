import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { confirmPixPayment, OrderServiceError } from "@/lib/services/order-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await confirmPixPayment(id);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status = err.code === "STATUS_CONFLICT" ? 409 : err.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao confirmar pagamento Pix:", err);
    return NextResponse.json({ error: "Erro ao confirmar pagamento Pix." }, { status: 500 });
  }
}
