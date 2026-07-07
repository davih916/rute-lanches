import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateFiscalConfigSchema } from "@/lib/validations/fiscal";
import { getFiscalConfigForAdmin, updateFiscalConfig } from "@/lib/services/fiscal-config-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const config = await getFiscalConfigForAdmin();
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateFiscalConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const config = await updateFiscalConfig(parsed.data);
  return NextResponse.json({ config });
}
