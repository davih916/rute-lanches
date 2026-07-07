import type { OrderWithRelations } from "@/lib/services/order-service";
import { getPaymentMethodLabel, type ReceiptWidth } from "@/lib/constants";
import { formatOrderNumber } from "@/lib/format";
import { formatCentsToBRL } from "@/lib/money";

interface ComandaProps {
  order: OrderWithRelations;
  storeName: string;
  receiptWidth: ReceiptWidth;
}

/**
 * Comanda de cozinha — impressa automaticamente quando o pedido vai para
 * "Preparando". Mostra o que precisa ser preparado em fonte bem grande (sem
 * dados de cliente ou total: isso já fica visível no painel) + a forma de
 * pagamento e troco no rodapé, para quem entrega/recebe saber se precisa
 * separar troco antes de sair.
 */
export function Comanda({ order, storeName, receiptWidth }: ComandaProps) {
  const widthClass = receiptWidth === "58mm" ? "w-[58mm] text-base" : "w-[80mm] text-lg";

  return (
    <div
      className={`comanda mx-auto break-words bg-white px-3 py-4 font-mono leading-snug text-black ${widthClass}`}
    >
      <p className="text-center font-extrabold uppercase">{storeName}</p>

      <p className="mt-4 text-center text-2xl font-extrabold leading-tight">
        PEDIDO {formatOrderNumber(order.orderNumber)}
      </p>

      {order.items.map((item) => (
        <div key={item.id} className="mt-4">
          <p className="text-2xl font-extrabold uppercase leading-tight">
            {item.quantity}X {item.productName}
          </p>

          {item.addons.length > 0 && (
            <div className="mt-2">
              <p className="font-extrabold uppercase">ADICIONAIS:</p>
              {item.addons.map((addon) => (
                <p key={addon.id} className="font-bold uppercase">
                  + {addon.name}
                </p>
              ))}
            </div>
          )}

          {item.notes && (
            <div className="mt-2">
              <p className="font-extrabold uppercase">OBS:</p>
              <p className="font-bold uppercase">{item.notes}</p>
            </div>
          )}
        </div>
      ))}

      {order.notes && (
        <div className="mt-4">
          <p className="font-extrabold uppercase">OBS. GERAL:</p>
          <p className="font-bold uppercase">{order.notes}</p>
        </div>
      )}

      {order.deliveryType === "entrega" && order.deliveryZone && (
        <div className="mt-4">
          <p className="font-extrabold uppercase">
            ENTREGA: {order.deliveryZone.neighborhood}
          </p>
          <p className="font-bold uppercase">
            Taxa: {formatCentsToBRL(order.deliveryFeeCents)}
          </p>
        </div>
      )}

      <div className="mt-4 border-t-2 border-dashed border-black pt-3">
        <p className="text-xl font-extrabold uppercase leading-tight">
          {getPaymentMethodLabel(order.paymentMethod)}
        </p>
        {order.paymentMethod === "dinheiro" && (
          <p className="font-bold uppercase">
            {order.cashChangeForCents
              ? `Troco p/ ${formatCentsToBRL(order.cashChangeForCents)}`
              : "Sem troco"}
          </p>
        )}
      </div>
    </div>
  );
}
