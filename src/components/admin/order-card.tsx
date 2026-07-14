"use client";

import Link from "next/link";
import { Printer, MapPin, Store } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import { formatOrderNumber, formatRelativeTime } from "@/lib/format";
import {
  NEXT_STATUS,
  NEXT_STATUS_ACTION_LABEL,
  getPaymentMethodLabel,
  DELIVERY_TYPE_LABELS,
  type OrderStatus,
  type PaymentMethod,
  type DeliveryType,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { FiscalAction } from "@/components/admin/fiscal-action";
import type { OrderWithRelations } from "@/lib/services/order-service";

interface OrderCardProps {
  order: OrderWithRelations;
  onChangeStatus: (orderId: string, status: OrderStatus, previousStatus: OrderStatus) => void;
  onAcknowledge: (orderId: string) => void;
  isUpdating: boolean;
  isNew: boolean;
}

export function OrderCard({ order, onChangeStatus, onAcknowledge, isUpdating, isNew }: OrderCardProps) {
  const status = order.status as OrderStatus;
  const deliveryType = order.deliveryType as DeliveryType;
  const next = NEXT_STATUS[status];
  const actionLabel = NEXT_STATUS_ACTION_LABEL[status];
  const isCash = (order.paymentMethod as PaymentMethod) === "dinheiro";
  const isPix = (order.paymentMethod as PaymentMethod) === "pix";

  return (
    <div
      onClick={() => onAcknowledge(order.id)}
      className={
        "flex flex-col gap-3 rounded-2xl border-2 bg-white p-5 shadow-sm transition-shadow " +
        (isNew ? "border-red-400 animate-pulse-border" : "border-neutral-200")
      }
    >
      <div className="flex items-start justify-between">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-extrabold text-neutral-900">
            {formatOrderNumber(order.orderNumber)}
          </p>
          {isNew && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              NOVO
            </span>
          )}
        </div>
        <Link
          href={`/admin/comanda/${order.id}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-50"
        >
          <Printer className="size-3.5" />
          {order.printedAt ? "Reimprimir" : "Imprimir"}
        </Link>
      </div>
      <p className="-mt-2 text-sm font-medium text-neutral-400">
        {formatRelativeTime(order.createdAt)}
      </p>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-600">
          {deliveryType === "entrega" ? <MapPin className="size-3.5" /> : <Store className="size-3.5" />}
          {DELIVERY_TYPE_LABELS[deliveryType]}
        </span>
      </div>

      <div className="text-base text-neutral-800">
        <p className="text-lg font-bold">{order.customer.name}</p>
        <p className="text-neutral-500">{order.customer.phone}</p>
        {deliveryType === "entrega" && (
          <>
            <p className="text-neutral-500">
              {order.customer.address}
              {order.customer.addressNumber ? `, ${order.customer.addressNumber}` : ""}
              {order.deliveryZone ? ` - ${order.deliveryZone.neighborhood}` : ""}
            </p>
            {order.deliveryZone && (
              <p className="text-sm font-medium text-neutral-400">
                Taxa de entrega: {formatCentsToBRL(order.deliveryFeeCents)}
              </p>
            )}
          </>
        )}
      </div>

      <ul className="flex flex-col gap-1.5 border-y border-neutral-100 py-3 text-base text-neutral-900">
        {order.items.map((item) => (
          <li key={item.id}>
            <p className="font-bold">
              {item.quantity}x {item.productName}
            </p>
            {item.addons.length > 0 && (
              <p className="pl-4 text-sm font-medium text-neutral-500">
                {item.addons.map((a) => `+ ${a.name}`).join(", ")}
              </p>
            )}
            {item.notes && (
              <p className="pl-4 text-sm font-bold uppercase text-amber-600">{item.notes}</p>
            )}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
          {order.notes}
        </p>
      )}

      <div className="flex items-center justify-between text-base">
        <span className="flex items-center gap-2 font-semibold text-neutral-600">
          {getPaymentMethodLabel(order.paymentMethod)}
          {isCash &&
            (order.cashChangeForCents ? (
              <> — troco p/ {formatCentsToBRL(order.cashChangeForCents)}</>
            ) : (
              <> — sem troco</>
            ))}
          {isPix && (
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs font-bold " +
                (order.paymentStatus === "pago"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700")
              }
            >
              {order.paymentStatus === "pago" ? "Pago" : "Pendente"}
            </span>
          )}
        </span>
        <span className="text-xl font-extrabold text-neutral-900">
          {formatCentsToBRL(order.totalCents)}
        </span>
      </div>

      {actionLabel && next && (
        <Button
          size="lg"
          loading={isUpdating}
          onClick={(e) => {
            e.stopPropagation();
            onChangeStatus(order.id, next, status);
          }}
          className="w-full text-base"
        >
          {actionLabel}
        </Button>
      )}

      {status !== "cancelado" && status !== "entregue" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangeStatus(order.id, "cancelado", status);
          }}
          className="text-center text-sm font-medium text-neutral-400 hover:text-red-500"
        >
          Cancelar pedido
        </button>
      )}

      {status === "entregue" && <FiscalAction orderId={order.id} fiscal={order.fiscal} />}
    </div>
  );
}
