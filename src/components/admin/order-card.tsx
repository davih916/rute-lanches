"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer, MapPin, Store, AlertTriangle, Check, X, MessageCircle } from "lucide-react";
import { formatCentsToBRL, reaisToCents } from "@/lib/money";
import { formatOrderNumber, formatRelativeTime } from "@/lib/format";
import {
  getNextStatus,
  getNextStatusActionLabel,
  getPaymentMethodLabel,
  DELIVERY_TYPE_LABELS,
  type OrderStatus,
  type PaymentMethod,
  type DeliveryType,
} from "@/lib/constants";
import {
  getStatusNotificationMessage,
  getDeliveryApprovedMessage,
  getDeliveryRejectionMessage,
  getOrderCancelledMessage,
  buildCustomerNotificationLink,
  parseNotifiedStatuses,
} from "@/lib/order-notifications";
import { Button } from "@/components/ui/button";
import type { OrderWithRelations } from "@/lib/services/order-service";

// Só é usado quando o pedido está "Entregue" — não precisa entrar no JS
// inicial do Kanban, que carrega dezenas de cards de uma vez.
const FiscalAction = dynamic(() =>
  import("@/components/admin/fiscal-action").then((m) => m.FiscalAction)
);

interface OrderCardProps {
  order: OrderWithRelations;
  onChangeStatus: (orderId: string, status: OrderStatus, previousStatus: OrderStatus) => void;
  onAcknowledge: (orderId: string) => void;
  isUpdating: boolean;
  isNew: boolean;
  storeName: string;
}

export function OrderCard({ order, onChangeStatus, onAcknowledge, isUpdating, isNew, storeName }: OrderCardProps) {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [confirmingPix, setConfirmingPix] = useState(false);

  const status = order.status as OrderStatus;
  const deliveryType = order.deliveryType as DeliveryType;
  const next = getNextStatus(status, deliveryType);
  const actionLabel = getNextStatusActionLabel(status, deliveryType);
  const isCash = (order.paymentMethod as PaymentMethod) === "dinheiro";
  const isPix = (order.paymentMethod as PaymentMethod) === "pix";
  const awaitingDeliveryApproval = status === "recebido" && deliveryType === "entrega";
  const notifiedStatuses = parseNotifiedStatuses(order.notifiedStatuses);
  const notifiableOrder = {
    orderNumber: order.orderNumber,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    storeName,
  };
  const notificationMessage = getStatusNotificationMessage(notifiableOrder, status);
  const alreadyNotified = notifiedStatuses.includes(status);

  async function refreshOrders() {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  async function handleApproveDelivery(e: React.MouseEvent) {
    e.stopPropagation();
    const input = window.prompt(
      "Qual a taxa de entrega pra esse endereço? (em reais, ex: 8,00 — deixe 0 se for grátis)",
      "0"
    );
    if (input === null) return;
    const feeCents = reaisToCents(input);
    setApproving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/approve-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível aprovar a entrega.");
        return;
      }
      toast.success("Entrega aprovada — pedido em preparo.");
      window.open(`/admin/comanda/${order.id}?autoprint=1`, "_blank", "width=380,height=640");
      if (order.customer.phone) {
        const message = getDeliveryApprovedMessage({
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          customerPhone: order.customer.phone,
          storeName,
          items: order.items.map((item) => ({ productName: item.productName, quantity: item.quantity })),
          totalCents: order.itemsTotalCents + feeCents,
        });
        window.open(buildCustomerNotificationLink(order.customer.phone, message), "_blank", "noopener,noreferrer");
      }
      await refreshOrders();
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setApproving(false);
    }
  }

  async function handleConfirmPix(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingPix(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/confirm-payment`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Não foi possível confirmar o pagamento.");
        return;
      }
      toast.success("Pix confirmado.");
      await refreshOrders();
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setConfirmingPix(false);
    }
  }

  async function handleRejectDelivery(e: React.MouseEvent) {
    e.stopPropagation();
    const reason = window.prompt(
      "Por que a entrega está sendo recusada? (opcional, aparece na mensagem pro cliente)",
      ""
    );
    if (reason === null) return;
    if (!confirm(`Recusar a entrega do pedido ${formatOrderNumber(order.orderNumber)}? O pedido será cancelado.`)) {
      return;
    }
    setRejecting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/reject-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Não foi possível recusar a entrega.");
        return;
      }
      toast.success("Entrega recusada — pedido cancelado.");
      if (order.customer.phone) {
        const message = getDeliveryRejectionMessage(
          { orderNumber: order.orderNumber, customerName: order.customer.name, customerPhone: order.customer.phone, storeName },
          reason
        );
        window.open(buildCustomerNotificationLink(order.customer.phone, message), "_blank", "noopener,noreferrer");
      }
      await refreshOrders();
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setRejecting(false);
    }
  }

  async function handleNotifyCustomer(e: React.MouseEvent, link: string) {
    e.stopPropagation();
    window.open(link, "_blank", "noopener,noreferrer");
    try {
      await fetch(`/api/orders/${order.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await refreshOrders();
    } catch {
      // Best-effort — o link já abriu, só não conseguimos marcar como avisado.
    }
  }

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
              {order.address}
              {order.addressNumber ? `, ${order.addressNumber}` : ""}
              {order.neighborhood ? ` - ${order.neighborhood}` : ""}
            </p>
            {order.complement && <p className="text-sm text-neutral-500">{order.complement}</p>}
            {order.reference && (
              <p className="text-sm text-neutral-400">Referência: {order.reference}</p>
            )}
            {!awaitingDeliveryApproval && !(status === "cancelado" && order.rejectionReason) && (
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

      {isPix && order.paymentStatus !== "pago" && (
        <Button
          size="sm"
          variant="outline"
          loading={confirmingPix}
          onClick={handleConfirmPix}
          className="w-full !border-emerald-300 text-emerald-700 hover:!bg-emerald-50"
        >
          <Check className="size-4" />
          Confirmar Pix recebido
        </Button>
      )}

      {awaitingDeliveryApproval ? (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-extrabold uppercase text-amber-800">
            <AlertTriangle className="size-4" />
            Aguardando confirmação da entrega
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              loading={approving}
              onClick={handleApproveDelivery}
              className="w-full !bg-emerald-600 text-base hover:!bg-emerald-700"
            >
              <Check className="size-4" />
              Aceitar
            </Button>
            <Button
              size="lg"
              variant="outline"
              loading={rejecting}
              onClick={handleRejectDelivery}
              className="w-full border-red-300 text-base text-red-600 hover:bg-red-50"
            >
              <X className="size-4" />
              Recusar
            </Button>
          </div>
        </div>
      ) : (
        actionLabel &&
        next && (
          <Button
            size="lg"
            loading={isUpdating}
            onClick={(e) => {
              e.stopPropagation();
              // "Saiu para entrega" abre o WhatsApp pro cliente automático,
              // igual já acontece ao aceitar/recusar a entrega — não depende
              // de alguém lembrar de clicar em "Avisar cliente" depois.
              if (next === "saiu_entrega" && order.customer.phone) {
                const message = getStatusNotificationMessage(notifiableOrder, "saiu_entrega");
                if (message) {
                  window.open(
                    buildCustomerNotificationLink(order.customer.phone, message),
                    "_blank",
                    "noopener,noreferrer"
                  );
                  fetch(`/api/orders/${order.id}/notify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "saiu_entrega" }),
                  }).catch(() => {});
                }
              }
              onChangeStatus(order.id, next, status);
            }}
            className="w-full text-base"
          >
            {actionLabel}
          </Button>
        )
      )}

      {notificationMessage && order.customer.phone && (
        <button
          onClick={(e) =>
            handleNotifyCustomer(e, buildCustomerNotificationLink(order.customer.phone, notificationMessage))
          }
          className={
            "flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors " +
            (alreadyNotified
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")
          }
        >
          <MessageCircle className="size-4" />
          {alreadyNotified ? "Avisado — reenviar no WhatsApp" : "Avisar cliente no WhatsApp"}
        </button>
      )}

      {!awaitingDeliveryApproval && status !== "cancelado" && status !== "entregue" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const reason = window.prompt(
              "Por que o pedido está sendo cancelado? (opcional, aparece na mensagem pro cliente)",
              ""
            );
            if (reason === null) return;
            if (!confirm(`Cancelar o pedido ${formatOrderNumber(order.orderNumber)}? Essa ação não pode ser desfeita.`)) {
              return;
            }
            if (order.customer.phone) {
              const message = getOrderCancelledMessage(
                {
                  orderNumber: order.orderNumber,
                  customerName: order.customer.name,
                  customerPhone: order.customer.phone,
                  storeName,
                  items: order.items.map((item) => ({ productName: item.productName, quantity: item.quantity })),
                  totalCents: order.totalCents,
                  paymentMethod: order.paymentMethod,
                },
                reason
              );
              window.open(buildCustomerNotificationLink(order.customer.phone, message), "_blank", "noopener,noreferrer");
              fetch(`/api/orders/${order.id}/notify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelado" }),
              }).catch(() => {});
            }
            onChangeStatus(order.id, "cancelado", status);
          }}
          className="text-center text-sm font-medium text-neutral-400 hover:text-red-500"
        >
          Cancelar pedido
        </button>
      )}

      {order.status === "cancelado" && order.rejectionReason && (
        <p className="text-xs text-neutral-400">Entrega recusada: {order.rejectionReason}</p>
      )}

      {status === "entregue" && <FiscalAction orderId={order.id} fiscal={order.fiscal} />}
    </div>
  );
}
