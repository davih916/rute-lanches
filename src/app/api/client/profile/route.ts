import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { clientProfileSchema } from "@/lib/validations/client";

export async function PATCH(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const parsed = clientProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados informados.", details: parsed.error.flatten() }, { status: 400 });
  const profile = await prisma.cliente.update({ where: { id: session.clienteId }, data: parsed.data });
  return NextResponse.json({ ok: true, profile });
}
