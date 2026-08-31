"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { formatCentsToBRL } from "@/lib/money";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, getPaymentMethodLabel, type OrderStatus } from "@/lib/constants";
import { orderToWhatsAppSummary } from "@/lib/whatsapp";
import type { OrderWithRelations } from "@/lib/services/order-service";

// Só um dos dois é usado por pedido (conforme a forma de pagamento) — divide
// o JS em partes carregadas sob demanda em vez de sempre entrar no bundle.
const PixPaymentPanel = dynamic(() =>
  import("@/components/site/pix-payment-panel").then((m) => m.PixPaymentPanel)
);
const WhatsAppOrderPanel = dynamic(() =>
  import("@/components/site/whatsapp-order-panel").then((m) => m.WhatsAppOrderPanel)
);

const TERMINAL_STATUSES = new Set(["entregue", "cancelado"]);

interface OrderDetailsCardProps {
  initialOrder: OrderWithRelations;
  storeWhatsapp: string | null;
  storeName: string;
}

/**
 * Diferente do Kanban do admin (que atualiza sozinho a cada 5s), essa tela
 * era renderizada só uma vez no servidor — se a loja avançasse o pedido
 * depois, o cliente só via a mudança recarregando a página manualmente.
 * Agora faz polling do próprio pedido (GET /api/orders/[id]) enquanto o
 * status não for final, pra refletir sozinho.
 */
export function OrderDetailsCard({ initialOrder, storeWhatsapp, storeName }: OrderDetailsCardProps) {
  const [order, setOrder] = useState<OrderWithRelations>(initialOrder);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(order.status)) return;

    let cancelled = false;

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${initialOrder.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setOrder(data.order);
        }
      } catch {
        // Falha de rede num poll: ignora e tenta de novo no próximo ciclo.
      }
    }

    pollRef.current = setInterval(fetchOrder, 6000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [initialOrder.id, order.status]);

  const status = order.status as OrderStatus;
  const statusColor = ORDER_STATUS_COLORS[status];
  const isDelivery = order.deliveryType === "entrega";
  const deliveryPending = isDelivery && (status === "recebido" || !order.deliveryFeeConfirmed);

  return (
    <>
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400">Pedido</p>
            <p className="text-lg font-bold text-neutral-900">#{order.orderNumber}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${statusColor.bg} ${statusColor.text}`}
          >
            {ORDER_STATUS_LABELS[status]}
          </span>
        </div>

        <ul className="flex flex-col gap-2 border-t border-neutral-100 pt-4">
          {order.items.map((item) => (
            <li key={item.id} className="text-sm">
              <div className="flex justify-between text-neutral-700">
                <span>
                  {item.quantity}x {item.productName}
                </span>
                <span>{formatCentsToBRL(item.unitPriceCents * item.quantity)}</span>
              </div>
              {item.addons.length > 0 && (
                <p className="pl-4 text-xs text-neutral-400">
                  {item.addons.map((a) => `+ ${a.name}`).join(", ")}
                </p>
              )}
              {item.notes && <p className="pl-4 text-xs italic text-neutral-400">&quot;{item.notes}&quot;</p>}
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm">
          <div className="flex justify-between text-neutral-500">
            <span>Itens</span>
            <span>{formatCentsToBRL(order.itemsTotalCents)}</span>
          </div>
          {isDelivery && (
            <div className="flex justify-between text-neutral-500">
              <span>Entrega</span>
              <span>
                {deliveryPending
                  ? "A combinar"
                  : order.deliveryFeeCents > 0
                    ? formatCentsToBRL(order.deliveryFeeCents)
                    : "Grátis"}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-neutral-900">
            <span>{deliveryPending ? "Total (sem a entrega)" : "Total"}</span>
            <span>{formatCentsToBRL(order.totalCents)}</span>
          </div>
          <div className="flex justify-between text-neutral-500">
            <span>Pagamento</span>
            <span>{getPaymentMethodLabel(order.paymentMethod)}</span>
          </div>
        </div>

        {deliveryPending && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            A loja está confirmando sua entrega — o valor final (com a taxa) é definido nessa
            confirmação.
            {order.paymentMethod === "pix" && " Assim que confirmar, você recebe o QR Code do Pix aqui."}
          </p>
        )}

        <div className="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
          <p className="font-medium text-neutral-800">{order.customer.name}</p>
          <p>{order.customer.phone}</p>
          {isDelivery && (
            <p>
              {order.address}
              {order.addressNumber ? `, ${order.addressNumber}` : ""}
              {order.neighborhood ? ` - ${order.neighborhood}` : ""}
            </p>
          )}
        </div>
      </div>

      {order.paymentMethod === "pix" && order.paymentStatus === "pendente" && !deliveryPending && (
        <PixPaymentPanel orderId={order.id} orderNumber={order.orderNumber} storeWhatsapp={storeWhatsapp} />
      )}

      {order.paymentMethod === "whatsapp" && (
        <WhatsAppOrderPanel storeWhatsapp={storeWhatsapp} order={orderToWhatsAppSummary(order, storeName)} />
      )}
    </>
  );
}
