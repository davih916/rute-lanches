import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { CLIENT_SESSION_COOKIE_NAME } from "@/lib/constants";

const SESSION_DURATION = "7d";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET ausente ou inválido.");
  return new TextEncoder().encode(secret);
}

export interface ClientSessionPayload {
  sub: string;
  clienteId: string;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

export async function createClientSessionToken(payload: ClientSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getJwtSecret());
}

export async function verifyClientSessionToken(token: string): Promise<ClientSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.sub !== "string" || typeof payload.clienteId !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, clienteId: payload.clienteId as string, email: payload.email as string, name: String(payload.name ?? ""), mustChangePassword: payload.mustChangePassword === true };
  } catch {
    return null;
  }
}

export async function setClientSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CLIENT_SESSION_COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function clearClientSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CLIENT_SESSION_COOKIE_NAME);
}

export async function getClientSession(): Promise<ClientSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_SESSION_COOKIE_NAME)?.value;
  return token ? verifyClientSessionToken(token) : null;
}
