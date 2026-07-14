import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import {
  checkLoginRateLimit,
  registerFailedLoginAttempt,
  clearLoginAttempts,
  getClientIp,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { password } = parsed.data;
  const rateLimitKey = `${getClientIp(request)}:login`;

  const rateLimit = checkLoginRateLimit(rateLimitKey);
  if (rateLimit.blocked) {
    const minutes = Math.max(1, Math.ceil((rateLimit.retryAfterSeconds ?? 0) / 60));
    return NextResponse.json(
      { error: `Muitas tentativas. Tente novamente em ${minutes} minuto(s).` },
      { status: 429 }
    );
  }

  try {
    // Login simplificado: só senha. Autentica contra o primeiro admin ativo
    // (hoje o sistema tem um único administrador).
    const admin = await prisma.admin.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });

    if (!admin) {
      registerFailedLoginAttempt(rateLimitKey);
      return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, admin.passwordHash);
    if (!validPassword) {
      registerFailedLoginAttempt(rateLimitKey);
      return NextResponse.json({ error: "Senha inválida." }, { status: 401 });
    }

    clearLoginAttempts(rateLimitKey);

    const token = await createSessionToken({
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (error) {
    // Erro inesperado (ex: JWT_SECRET ausente/curta demais, banco fora do ar) — sempre
    // devolve JSON em vez de deixar a rota quebrar sem corpo (o client interpretaria
    // isso como "falha de conexão" ao tentar fazer res.json() numa resposta não-JSON).
    console.error(
      "[POST /api/auth/login] Erro inesperado — verifique JWT_SECRET e DATABASE_URL.",
      error
    );
    return NextResponse.json(
      { error: "Erro ao processar login. Tente novamente em instantes." },
      { status: 500 }
    );
  }
}
