import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMensalidadePixState } from "@/lib/services/mensalidade-pix-service";

/**
 * Consultado pelo próprio banner de cobrança no dashboard da loja (sessão de
 * admin normal, não a senha do /admin/dev) — gera/retorna o QR Code da
 * mensalidade e confirma sozinho quando o pagamento cai.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const state = await getMensalidadePixState();
  return NextResponse.json(state);
}
