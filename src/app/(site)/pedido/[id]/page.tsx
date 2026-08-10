import { notFound } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CheckCircle2 } from "lucide-react";
import { getOrderById } from "@/lib/services/order-service";
import { getSettingsSafe } from "@/lib/services/settings-service";
import { formatCentsToBRL } from "@/lib/money";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  getPaymentMethodLabel,
  type OrderStatus,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { orderToWhatsAppSummary } from "@/lib/whatsapp";

// Só um dos dois é usado por pedido (conforme a forma de pagamento) — divide
// o JS em partes carregadas sob demanda em vez de sempre entrar no bundle.
const PixPaymentPanel = dynamic(() =>
  import("@/components/site/pix-payment-panel").then((m) => m.PixPaymentPanel)
);
const WhatsAppOrderPanel = dynamic(() =>
  import("@/components/site/whatsapp-order-panel").then((m) => m.WhatsAppOrderPanel)
);

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrderById(id), getSettingsSafe()]);

  if (!order) notFound();

  const status = order.status as OrderStatus;
  const statusColor = ORDER_STATUS_COLORS[status];
  const isDelivery = order.deliveryType === "entrega";
  const deliveryPending = isDelivery && status === "recebido";

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div
          className="mb-3 flex size-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-secondary) 12%, white)", color: "var(--brand-secondary)" }}
        >
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900">Pedido enviado!</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Acompanhe o status do seu pedido abaixo. Guarde este link.
        </p>
      </div>

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

      {order.paymentMethod === "pix" && order.paymentStatus === "pendente" && (
        <PixPaymentPanel orderId={order.id} />
      )}

      {order.paymentMethod === "whatsapp" && (
        <WhatsAppOrderPanel
          storeWhatsapp={settings.whatsapp}
          order={orderToWhatsAppSummary(order, settings.storeName)}
        />
      )}

      <Link href="/" className="mt-5 block">
        <Button variant="outline" size="lg" className="w-full">
          Voltar ao cardápio
        </Button>
      </Link>
    </div>
  );
}
