"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWhatsAppOrderLink, type WhatsAppOrderSummary } from "@/lib/whatsapp";

interface WhatsAppOrderPanelProps {
  storeWhatsapp: string | null;
  order: WhatsAppOrderSummary;
}

/** Painel de confirmação para pedidos com pagamento "Combinar pelo WhatsApp" (ver pix-payment-panel.tsx para o equivalente do Pix). */
export function WhatsAppOrderPanel({ storeWhatsapp, order }: WhatsAppOrderPanelProps) {
  if (!storeWhatsapp) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
        A loja ainda não configurou um número de WhatsApp. Entre em contato por outro meio para
        confirmar o pedido.
      </div>
    );
  }

  const link = buildWhatsAppOrderLink(storeWhatsapp, order);

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-neutral-200 bg-white p-5 text-center">
      <p className="text-sm font-semibold text-neutral-900">Confirme seu pedido pelo WhatsApp</p>
      <p className="text-xs text-neutral-500">
        Clique no botão abaixo para enviar o resumo do pedido pronto para a loja.
      </p>
      <a href={link} target="_blank" rel="noopener noreferrer" className="w-full">
        <Button type="button" size="lg" className="w-full !bg-emerald-500 hover:!bg-emerald-600">
          <MessageCircle className="size-5" />
          Confirmar no WhatsApp
        </Button>
      </a>
    </div>
  );
}
