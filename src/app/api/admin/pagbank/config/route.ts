import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updatePagBankConfigSchema } from "@/lib/validations/pagbank";
import { getPagBankConfigForAdmin, updatePagBankConfig } from "@/lib/services/pagbank-config-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const config = await getPagBankConfigForAdmin();
  return NextResponse.json({ config });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updatePagBankConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const config = await updatePagBankConfig(parsed.data);
  return NextResponse.json({ config });
}
