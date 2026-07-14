import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createClientSessionToken, setClientSessionCookie } from "@/lib/client-auth";
import { clientLoginSchema } from "@/lib/validations/client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = clientLoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados informados.", details: parsed.error.flatten() }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.clienteUsuario.findUnique({ where: { email }, include: { cliente: true } });
  if (!user || !user.ativo || user.cliente.status !== "ativo" || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "E-mail ou senha incorretos. Confira seus dados e tente novamente." }, { status: 401 });
  }

  const token = await createClientSessionToken({ sub: user.id, clienteId: user.clienteId, email: user.email, name: user.nome, mustChangePassword: user.deveAlterarSenha });
  await setClientSessionCookie(token);
  return NextResponse.json({ ok: true, mustChangePassword: user.deveAlterarSenha });
}
