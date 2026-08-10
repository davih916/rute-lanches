import type { OrderWithRelations } from "@/lib/services/order-service";
import { getPaymentMethodLabel, type ReceiptWidth, type DeliveryType } from "@/lib/constants";
import { formatOrderNumber } from "@/lib/format";
import { formatCentsToBRL } from "@/lib/money";

interface ComandaProps {
  order: OrderWithRelations;
  storeName: string;
  receiptWidth: ReceiptWidth;
}

/**
 * Comanda impressa automaticamente quando o pedido avança (entrega aprovada →
 * preparando, ou preparando → saiu para entrega/pronto para retirada). Mostra
 * tudo que quem entrega/atende precisa: cliente, endereço completo (só
 * entrega), itens com preço, taxa, total e forma de pagamento com troco.
 */
export function Comanda({ order, storeName, receiptWidth }: ComandaProps) {
  const widthClass = receiptWidth === "58mm" ? "w-[58mm] text-sm" : "w-[80mm] text-base";
  const deliveryType = order.deliveryType as DeliveryType;
  const isDelivery = deliveryType === "entrega";
  const typeLabel = isDelivery ? "ENTREGA" : deliveryType === "balcao" ? "BALCÃO" : "RETIRADA";

  return (
    <div
      className={`comanda mx-auto break-words bg-white px-3 py-4 font-mono leading-snug text-black ${widthClass}`}
    >
      <p className="text-center text-lg font-extrabold uppercase">{storeName}</p>
      <p className="text-center text-2xl font-extrabold leading-tight">
        PEDIDO {formatOrderNumber(order.orderNumber)}
      </p>

      <div className="mt-3 border-t-2 border-dashed border-black pt-2">
        <p className="font-extrabold uppercase">CLIENTE:</p>
        <p className="font-bold">{order.customer.name}</p>
        {order.customer.phone && <p>{order.customer.phone}</p>}
      </div>

      {isDelivery && (
        <div className="mt-3 border-t-2 border-dashed border-black pt-2">
          <p className="font-extrabold uppercase">ENDEREÇO:</p>
          <p className="font-bold">
            {order.address}
            {order.addressNumber ? `, ${order.addressNumber}` : ""}
          </p>
          {order.neighborhood && <p className="font-bold">Bairro: {order.neighborhood}</p>}
          {order.complement && <p>{order.complement}</p>}
          {order.reference && <p>Referência: {order.reference}</p>}
        </div>
      )}

      <p className="mt-3 border-t-2 border-dashed border-black pt-2 font-extrabold uppercase">
        TIPO: {typeLabel}
      </p>

      <div className="mt-3 border-t-2 border-dashed border-black pt-2">
        <p className="font-extrabold uppercase">ITENS DO PEDIDO</p>
        {order.items.map((item) => (
          <div key={item.id} className="mt-2">
            <div className="flex justify-between gap-2">
              <p className="font-extrabold uppercase leading-tight">
                {item.quantity}x {item.productName}
              </p>
              <p className="shrink-0 font-bold">
                {formatCentsToBRL(item.unitPriceCents * item.quantity)}
              </p>
            </div>

            {item.addons.length > 0 && (
              <div>
                {item.addons.map((addon) => (
                  <p key={addon.id} className="pl-3 text-sm font-bold uppercase">
                    + {addon.name}
                  </p>
                ))}
              </div>
            )}

            {item.notes && (
              <p className="pl-3 text-sm font-bold uppercase text-black">OBS: {item.notes}</p>
            )}
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mt-3 border-t-2 border-dashed border-black pt-2">
          <p className="font-extrabold uppercase">OBS. GERAL:</p>
          <p className="font-bold uppercase">{order.notes}</p>
        </div>
      )}

      <div className="mt-3 border-t-2 border-dashed border-black pt-2">
        {isDelivery && (
          <div className="flex justify-between font-bold">
            <p>TAXA DE ENTREGA:</p>
            <p>{formatCentsToBRL(order.deliveryFeeCents)}</p>
          </div>
        )}
        <div className="flex justify-between text-lg font-extrabold">
          <p>TOTAL:</p>
          <p>{formatCentsToBRL(order.totalCents)}</p>
        </div>
      </div>

      <div className="mt-3 border-t-2 border-dashed border-black pt-2">
        <p className="font-extrabold uppercase">FORMA DE PAGAMENTO:</p>
        <p className="text-lg font-extrabold uppercase leading-tight">
          {getPaymentMethodLabel(order.paymentMethod)}
        </p>
        {order.paymentMethod === "dinheiro" && (
          <div className="mt-1 font-bold">
            {order.cashChangeForCents ? (
              <>
                <div className="flex justify-between">
                  <p>VALOR RECEBIDO:</p>
                  <p>{formatCentsToBRL(order.cashChangeForCents)}</p>
                </div>
                <div className="flex justify-between">
                  <p>TROCO:</p>
                  <p>{formatCentsToBRL(Math.max(0, order.cashChangeForCents - order.totalCents))}</p>
                </div>
              </>
            ) : (
              <p>SEM TROCO</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
