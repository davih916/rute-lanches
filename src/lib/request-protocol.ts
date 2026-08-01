import "server-only";
import { headers } from "next/headers";

/**
 * Se a conexão que chegou no Next.js é HTTPS de verdade — usado para decidir a flag
 * `secure` dos cookies de sessão. Atrás de um reverse proxy (Nginx), a conexão local
 * entre o proxy e o Next.js é sempre HTTP puro; o protocolo real do cliente vem no
 * header `X-Forwarded-Proto` (configurado em nginx/default.conf e nos exemplos de
 * deploy). Sem esse header (ex: implantação recém-feita, ainda sem domínio/HTTPS),
 * cair pra "secure" marcaria o cookie como HTTPS-only e o navegador o descartaria
 * silenciosamente ao acessar por http://IP — quebrando o login sem erro nenhum.
 */
export async function isSecureRequest(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;

  const headersList = await headers();
  const proto = headersList.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";

  return true;
}
