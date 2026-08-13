"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, Wallet } from "lucide-react";
import { toast } from "sonner";
import { OrderCard } from "@/components/admin/order-card";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/money";
import { formatOrderNumber } from "@/lib/format";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_TYPE_LABELS,
  DELIVERY_TYPES,
  type OrderStatus,
  type DeliveryType,
} from "@/lib/constants";
import { unlockAudio, playNewOrderSound } from "@/lib/notification-sound";
import type { OrderWithRelations } from "@/lib/services/order-service";

interface KanbanBoardProps {
  initialOrders: OrderWithRelations[];
  initialPendingPixPayments: OrderWithRelations[];
  storeName: string;
}

const ALARM_REPEAT_MS = 8000;
// A coluna "aguardando_pagamento" nunca aparece no board — esses pedidos
// ficam escondidos até o pagamento ser confirmado (ver banner abaixo).
const BOARD_STATUSES = ORDER_STATUSES.filter((s) => s !== "aguardando_pagamento");

interface OrdersResponse {
  orders: OrderWithRelations[];
  pendingPixPayments: OrderWithRelations[];
}

async function fetchOrders(): Promise<OrdersResponse> {
  const res = await fetch("/api/orders", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar pedidos");
  return res.json();
}

export function KanbanBoard({ initialOrders, initialPendingPixPayments, storeName }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const knownOrderIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const isFirstRun = useRef(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmingPixId, setConfirmingPixId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryType | "todos">("todos");

  const {
    data: { orders: allOrders, pendingPixPayments } = {
      orders: initialOrders,
      pendingPixPayments: initialPendingPixPayments,
    },
  } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    initialData: { orders: initialOrders, pendingPixPayments: initialPendingPixPayments },
    refetchInterval: 5000,
  });

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (deliveryFilter !== "todos" && o.deliveryType !== deliveryFilter) return false;
      if (!term) return true;
      return (
        o.customer.name.toLowerCase().includes(term) ||
        o.customer.phone.replace(/\D/g, "").includes(term.replace(/\D/g, "")) ||
        String(o.orderNumber).includes(term)
      );
    });
  }, [allOrders, search, deliveryFilter]);

  const pendingNewOrders = allOrders.filter(
    (o) => o.status === "recebido" && !acknowledgedIds.has(o.id)
  );

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const newOnes = allOrders.filter(
      (o) => o.status === "recebido" && !knownOrderIds.current.has(o.id)
    );
    if (newOnes.length > 0) {
      playNewOrderSound();
    }
    knownOrderIds.current = new Set(allOrders.map((o) => o.id));

    // Não deixa acumular ids de pedidos que já saíram de "recebido".
    setAcknowledgedIds((prev) => {
      const stillPending = new Set(
        allOrders.filter((o) => o.status === "recebido").map((o) => o.id)
      );
      const next = new Set([...prev].filter((id) => stillPending.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [allOrders]);

  // Repete o alerta sonoro enquanto houver pedido novo não reconhecido.
  useEffect(() => {
    if (pendingNewOrders.length === 0) return;
    const interval = setInterval(() => playNewOrderSound(), ALARM_REPEAT_MS);
    return () => clearInterval(interval);
  }, [pendingNewOrders.length]);

  function handleAcknowledge(orderId: string) {
    setAcknowledgedIds((prev) => (prev.has(orderId) ? prev : new Set(prev).add(orderId)));
  }

  const statusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      previousStatus,
    }: {
      orderId: string;
      status: OrderStatus;
      previousStatus: OrderStatus;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, previousStatus }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao atualizar status");
      }
      return data;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  function handleChangeStatus(orderId: string, status: OrderStatus, previousStatus: OrderStatus) {
    setUpdatingId(orderId);
    statusMutation.mutate(
      { orderId, status, previousStatus },
      {
        onSuccess: () => {
          const shouldAutoPrint =
            (previousStatus === "recebido" && status === "preparando") ||
            (previousStatus === "preparando" && status === "saiu_entrega") ||
            (previousStatus === "preparando" && status === "pronto_retirada");
          if (shouldAutoPrint) {
            window.open(
              `/admin/comanda/${orderId}?autoprint=1`,
              "_blank",
              "width=380,height=640"
            );
          }
        },
        onError: (error) => {
          // Conflito (outra pessoa já mudou o status): a tela é atualizada
          // sozinha pelo invalidateQueries no onSettled, só avisa o admin.
          toast.error(error instanceof Error ? error.message : "Falha ao atualizar status.");
        },
        onSettled: () => setUpdatingId(null),
      }
    );
  }

  async function handleConfirmPixPayment(orderId: string, orderNumber: number) {
    setConfirmingPixId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-payment`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Falha ao confirmar pagamento.");
        return;
      }
      toast.success(`Pagamento do pedido ${formatOrderNumber(orderNumber)} confirmado.`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setConfirmingPixId(null);
    }
  }

  return (
    <div className="flex h-full flex-col" onClick={unlockAudio}>
      {pendingPixPayments.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-orange-200 bg-orange-50 px-6 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
            <Wallet className="size-3.5" />
            {pendingPixPayments.length} pedido(s) aguardando confirmação de pagamento Pix — confira no
            app do seu banco antes de confirmar.
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingPixPayments.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-1.5 text-sm"
              >
                <span className="font-semibold text-neutral-700">
                  {formatOrderNumber(order.orderNumber)}
                </span>
                <span className="text-neutral-500">{order.customer.name}</span>
                <span className="font-semibold text-neutral-700">
                  {formatCentsToBRL(order.totalCents)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleConfirmPixPayment(order.id, order.orderNumber)}
                  loading={confirmingPixId === order.id}
                >
                  Confirmar pagamento
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-white px-6 py-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou nº do pedido"
            className="h-9 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-8 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-neutral-400 hover:bg-neutral-100"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setDeliveryFilter("todos")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              deliveryFilter === "todos"
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Todos
          </button>
          {DELIVERY_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setDeliveryFilter(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                deliveryFilter === type
                  ? "bg-[var(--brand-primary)] text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {DELIVERY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
        {(search || deliveryFilter !== "todos") && (
          <span className="text-xs text-neutral-400">{orders.length} resultado(s)</span>
        )}
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex h-full gap-4">
          {BOARD_STATUSES.map((status) => {
            const columnOrders = orders.filter((o) => o.status === status);
            const colors = ORDER_STATUS_COLORS[status];
            return (
              <div key={status} className="flex w-80 shrink-0 flex-col sm:w-96">
                <div className={`mb-3 flex items-center gap-2 rounded-lg px-4 py-3 ${colors.bg}`}>
                  <span className={`size-2.5 rounded-full ${colors.dot}`} />
                  <span className={`text-base font-extrabold ${colors.text}`}>
                    {ORDER_STATUS_LABELS[status]}
                  </span>
                  <span className="ml-auto text-sm font-bold text-neutral-400">
                    {columnOrders.length}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
                  {columnOrders.length === 0 ? (
                    <p className="px-2 text-sm text-neutral-300">Nenhum pedido</p>
                  ) : (
                    <AnimatePresence initial={false}>
                      {columnOrders.map((order) => (
                        <motion.div
                          key={order.id}
                          layout
                          initial={{ opacity: 0, y: -12, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.2 }}
                        >
                          <OrderCard
                            order={order}
                            onChangeStatus={handleChangeStatus}
                            onAcknowledge={handleAcknowledge}
                            isUpdating={updatingId === order.id}
                            isNew={order.status === "recebido" && !acknowledgedIds.has(order.id)}
                            storeName={storeName}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
