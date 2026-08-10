import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateOrderStatusSchema } from "@/lib/validations/order";
import { updateOrderStatus, getOrderById, OrderServiceError } from "@/lib/services/order-service";
import { issueFiscalDocumentForOrder, FiscalServiceError } from "@/lib/services/fiscal-service";

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
    let order = await updateOrderStatus(
      id,
      parsed.data.status,
      session.sub,
      parsed.data.previousStatus
    );

    // Pedido ficou pronto (saiu para entrega/retirada): emite a NFC-e sozinho
    // se o cliente marcou "quero nota fiscal" no checkout. Erros ficam
    // registrados no próprio pedido (fiscal.status/errorMessage) — o lojista
    // resolve depois pelo botão manual existente, sem travar a mudança de status.
    if (
      (parsed.data.status === "saiu_entrega" || parsed.data.status === "pronto_retirada") &&
      order.wantsInvoice &&
      order.fiscal?.status !== "emitida"
    ) {
      try {
        await issueFiscalDocumentForOrder(id);
        order = (await getOrderById(id)) ?? order;
      } catch (err) {
        if (err instanceof FiscalServiceError) {
          console.error(`Emissão automática de NFC-e falhou (pedido ${id}):`, err.message);
        } else {
          console.error(`Erro inesperado na emissão automática de NFC-e (pedido ${id}):`, err);
        }
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      const status =
        err.code === "STATUS_CONFLICT"
          ? 409
          : err.code === "INVALID_STATUS_TRANSITION"
            ? 400
            : 404;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao atualizar status do pedido:", err);
    return NextResponse.json({ error: "Erro ao atualizar status." }, { status: 500 });
  }
}
