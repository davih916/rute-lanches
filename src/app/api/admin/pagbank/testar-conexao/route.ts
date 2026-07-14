import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { testPagBankConnection, PagBankConfigServiceError } from "@/lib/services/pagbank-config-service";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    await testPagBankConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PagBankConfigServiceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Erro ao testar conexão com o PagBank:", err);
    return NextResponse.json({ error: "Erro ao testar conexão com o PagBank." }, { status: 500 });
  }
}
