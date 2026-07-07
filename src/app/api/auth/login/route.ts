import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/auth";
import { checkLoginRateLimit, registerFailedLoginAttempt, clearLoginAttempts } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

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
}
