import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { notifyStatusSchema } from "@/lib/validations/order";
import { markStatusNotified, OrderServiceError } from "@/lib/services/order-service";

/** Registra que o admin já clicou pra avisar o cliente sobre esse status (ver order-notifications.ts). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = notifyStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    const order = await markStatusNotified(id, parsed.data.status);
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("Erro ao marcar notificação:", err);
    return NextResponse.json({ error: "Erro ao marcar notificação." }, { status: 500 });
  }
}
