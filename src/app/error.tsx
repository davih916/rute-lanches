"use client";

import { useEffect } from "react";

/**
 * Error boundary da árvore de rotas (não cobre falhas no próprio layout raiz —
 * ver global-error.tsx para isso). Next.js troca qualquer erro não tratado em
 * Server/Client Component por esta tela em vez do crash genérico da Vercel.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg font-bold text-neutral-900">Algo deu errado</p>
      <p className="max-w-sm text-sm text-neutral-500">
        Não foi possível carregar esta página agora. Tente novamente em instantes.
      </p>
      {error.digest && (
        <p className="text-xs text-neutral-400">Código de referência: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Tentar novamente
      </button>
    </div>
  );
}
