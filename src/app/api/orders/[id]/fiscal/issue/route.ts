import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { issueFiscalDocumentForOrder, FiscalServiceError } from "@/lib/services/fiscal-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const fiscal = await issueFiscalDocumentForOrder(id);
    return NextResponse.json({ fiscal });
  } catch (err) {
    if (err instanceof FiscalServiceError) {
      const status = err.code === "ORDER_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("Erro ao emitir NFC-e:", err);
    return NextResponse.json({ error: "Erro ao emitir NFC-e." }, { status: 500 });
  }
}
