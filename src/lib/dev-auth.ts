import "server-only";
import { timingSafeEqual } from "crypto";

/**
 * Senha do painel /admin/dev (uso exclusivo do desenvolvedor) — separada do
 * login da loja, definida só via variável de ambiente (DEV_PANEL_PASSWORD),
 * nunca commitada. Comparação em tempo constante pra não vazar o tamanho
 * certo por timing.
 */
export function verifyDevPassword(password: string): { ok: true } | { ok: false; error: string; status: number } {
  const expected = process.env.DEV_PANEL_PASSWORD;
  if (!expected) {
    return { ok: false, error: "DEV_PANEL_PASSWORD não configurada no servidor.", status: 500 };
  }

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(password.padEnd(expectedBuf.length, "\0").slice(0, expectedBuf.length));
  const matches = password.length === expected.length && timingSafeEqual(expectedBuf, providedBuf);

  if (!matches) {
    return { ok: false, error: "Senha incorreta.", status: 401 };
  }
  return { ok: true };
}
