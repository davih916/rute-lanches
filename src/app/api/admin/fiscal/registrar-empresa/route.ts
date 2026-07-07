import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { registerCompanyWithProvider, FiscalConfigServiceError } from "@/lib/services/fiscal-config-service";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    await registerCompanyWithProvider();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FiscalConfigServiceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Erro ao cadastrar empresa fiscal:", err);
    return NextResponse.json({ error: "Erro ao cadastrar empresa." }, { status: 500 });
  }
}
