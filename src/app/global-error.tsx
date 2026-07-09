"use client";

import { useEffect } from "react";

/**
 * Cobre erros que acontecem no próprio layout raiz (ex: getSettingsSafe
 * lançando mesmo com o fallback, ou erro de render antes do <html>/<body>
 * montar) — precisa renderizar sua própria tag html/body, já que substitui
 * o layout inteiro. Usa estilo inline (não classes Tailwind) porque essa
 * página bypassa o layout raiz e não pode contar com o CSS global ter carregado.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#171717" }}>
          Algo deu errado
        </p>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#737373" }}>
          Não foi possível carregar o site agora. Tente novamente em instantes.
        </p>
        {error.digest && (
          <p style={{ fontSize: "0.75rem", color: "#a3a3a3" }}>
            Código de referência: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            borderRadius: "0.5rem",
            backgroundColor: "#171717",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 500,
            padding: "0.5rem 1rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
