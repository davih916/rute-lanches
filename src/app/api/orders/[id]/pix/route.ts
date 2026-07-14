import { NextResponse } from "next/server";
import { getOrCreatePixCharge, PagBankServiceError } from "@/lib/services/pagbank-service";

/** Público: o cliente que acabou de fazer o pedido consulta/gera a cobrança Pix pelo id do pedido. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const charge = await getOrCreatePixCharge(id);
    return NextResponse.json({ charge });
  } catch (err) {
    if (err instanceof PagBankServiceError) {
      const status = err.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao gerar cobrança Pix:", err);
    return NextResponse.json({ error: "Erro ao gerar cobrança Pix." }, { status: 500 });
  }
}
