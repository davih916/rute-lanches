"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2 } from "lucide-react";
import { FISCAL_STATUS_LABELS, type FiscalStatus } from "@/lib/constants";
import type { OrderWithRelations } from "@/lib/services/order-service";

interface FiscalActionProps {
  orderId: string;
  fiscal: OrderWithRelations["fiscal"];
}

const STATUS_STYLES: Record<FiscalStatus, string> = {
  aguardando_emissao: "bg-neutral-100 text-neutral-600",
  emitindo: "bg-blue-50 text-blue-700",
  emitida: "bg-emerald-50 text-emerald-700",
  erro: "bg-red-50 text-red-700",
};

export function FiscalAction({ orderId, fiscal }: FiscalActionProps) {
  const queryClient = useQueryClient();
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!fiscal) return null;
  const status = fiscal.status as FiscalStatus;

  async function handleIssue(e: React.MouseEvent) {
    e.stopPropagation();
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/fiscal/issue`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao emitir NFC-e.");
      } else {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    } catch {
      setError("Falha de conexão.");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-neutral-100 pt-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}>
          NFC-e: {FISCAL_STATUS_LABELS[status]}
        </span>

        {status === "emitida" ? (
          <a
            href={`/api/orders/${orderId}/fiscal/pdf`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
          >
            <FileText className="size-3.5" />
            Ver DANFCE
          </a>
        ) : status === "emitindo" ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-700">
            <Loader2 className="size-3.5 animate-spin" />
            Emitindo...
          </span>
        ) : (
          <button
            onClick={handleIssue}
            disabled={issuing}
            className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {issuing && <Loader2 className="size-3.5 animate-spin" />}
            {status === "erro" ? "Tentar emitir novamente" : "Emitir NFC-e"}
          </button>
        )}
      </div>
      {status === "emitida" && fiscal.numero && (
        <p className="text-xs text-neutral-400">
          NFC-e nº {fiscal.numero}
          {fiscal.chaveAcesso ? ` — chave ${fiscal.chaveAcesso}` : ""}
        </p>
      )}
      {(error || (status === "erro" && fiscal.errorMessage)) && (
        <p className="text-xs font-medium text-red-600">{error ?? fiscal.errorMessage}</p>
      )}
    </div>
  );
}
