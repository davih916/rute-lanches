import { NextResponse } from "next/server";
import { getClientSession, createClientSessionToken, setClientSessionCookie } from "@/lib/client-auth";
import { clientPasswordSchema } from "@/lib/validations/client";
import { changeClientPassword } from "@/lib/services/client-service";

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = clientPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados informados.", details: parsed.error.flatten() }, { status: 400 });
  try {
    await changeClientPassword(session.sub, parsed.data.currentPassword, parsed.data.newPassword);
    await setClientSessionCookie(await createClientSessionToken({ ...session, mustChangePassword: false }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível alterar a senha." }, { status: 400 });
  }
}
