import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validations/auth";
import { changePassword, AdminServiceError } from "@/lib/services/admin-service";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await changePassword(session.sub, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminServiceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
