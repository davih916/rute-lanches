import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { CLIENT_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/constants";

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/cliente")) {
    if (pathname === "/cliente/login" || pathname === "/cliente/esqueci-senha") return NextResponse.next();
    const validClientSession = await isValidSession(request.cookies.get(CLIENT_SESSION_COOKIE_NAME)?.value);
    if (!validClientSession) {
      const loginUrl = new URL("/cliente/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const isPublicAdminRoute = pathname === "/admin/login";
  if (isPublicAdminRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidSession(token);

  if (!valid) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Protege apenas as páginas do painel (renderização). Cada API route sob
// /api faz sua própria checagem de sessão via getSession() — necessário
// porque algumas (ex: POST /api/orders) são públicas por design.
export const config = {
  matcher: ["/admin/:path*", "/cliente/:path*"],
};
