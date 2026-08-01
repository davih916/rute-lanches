"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PixChargeData {
  status: "aguardando_pagamento" | "pago" | "expirado" | "erro";
  qrCodeText: string | null;
  qrCodeImageUrl: string | null;
  errorMessage: string | null;
}

export function PixPaymentPanel({ orderId }: { orderId: string }) {
  const [charge, setCharge] = useState<PixChargeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCharge() {
      try {
        const res = await fetch(`/api/orders/${orderId}/pix`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setCharge(data.charge);
          if (data.charge.status === "pago" && pollRef.current) {
            clearInterval(pollRef.current);
          }
        }
      } catch {
        // Falha de rede num poll: ignora e tenta de novo no próximo ciclo de 5s.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCharge();
    pollRef.current = setInterval(fetchCharge, 5000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  async function handleCopy() {
    if (!charge?.qrCodeText) return;

    // navigator.clipboard só existe em contexto seguro (HTTPS/localhost) —
    // numa implantação recém-feita ainda em http://IP, ele não existe e
    // lançaria um erro. Fallback com execCommand cobre esse caso.
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(charge.qrCodeText);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = charge.qrCodeText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
        <Loader2 className="size-4 animate-spin" /> Gerando cobrança Pix...
      </div>
    );
  }

  if (!charge) return null;

  if (charge.status === "pago") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-medium text-emerald-700">
        <Check className="size-5" /> Pagamento confirmado!
      </div>
    );
  }

  if (charge.status === "erro") {
    return (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Não foi possível gerar o Pix agora{charge.errorMessage ? `: ${charge.errorMessage}` : "."} Fale
        com a loja para combinar o pagamento.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 text-center">
      <p className="text-sm font-semibold text-neutral-900">Pague com Pix para confirmar o pedido</p>
      {charge.qrCodeImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={charge.qrCodeImageUrl} alt="QR Code Pix" className="size-48 rounded-lg border border-neutral-100" />
      )}
      {charge.qrCodeText && (
        <div className="flex w-full flex-col gap-2">
          <p className="text-xs text-neutral-400">Ou copie o código:</p>
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-neutral-600">
              {charge.qrCodeText}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Loader2 className="size-3 animate-spin" /> Aguardando confirmação do pagamento...
      </p>
    </div>
  );
}
