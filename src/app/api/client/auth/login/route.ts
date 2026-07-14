import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createClientSessionToken, setClientSessionCookie } from "@/lib/client-auth";
import { clientLoginSchema } from "@/lib/validations/client";
import { checkLoginRateLimit, registerFailedLoginAttempt, clearLoginAttempts, getClientIp } from "@/lib/rate-limit";

// Hash dummy só para gastar o mesmo tempo de bcrypt quando o e-mail não existe
// (evita que o tempo de resposta revele se a conta existe ou não).
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8vC0Q1lJfWwF6vSQ1z1qKp0h.5G6dO";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = clientLoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Revise os dados informados.", details: parsed.error.flatten() }, { status: 400 });

  const rateLimitKey = `${getClientIp(request)}:client-login`;
  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (rateLimit.blocked) {
    const minutes = Math.max(1, Math.ceil((rateLimit.retryAfterSeconds ?? 0) / 60));
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${minutes} minuto(s).` },
      { status: 429 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.clienteUsuario.findUnique({ where: { email }, include: { cliente: true } });
  const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.ativo || user.cliente.status !== "ativo" || !passwordOk) {
    registerFailedLoginAttempt(rateLimitKey);
    return NextResponse.json({ error: "E-mail ou senha incorretos. Confira seus dados e tente novamente." }, { status: 401 });
  }

  clearLoginAttempts(rateLimitKey);

  const token = await createClientSessionToken({ sub: user.id, clienteId: user.clienteId, email: user.email, name: user.nome, mustChangePassword: user.deveAlterarSenha });
  await setClientSessionCookie(token);
  return NextResponse.json({ ok: true, mustChangePassword: user.deveAlterarSenha });
}
