"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OrderCard } from "@/components/admin/order-card";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type OrderStatus,
} from "@/lib/constants";
import { unlockAudio, playNewOrderSound } from "@/lib/notification-sound";
import type { OrderWithRelations } from "@/lib/services/order-service";

interface KanbanBoardProps {
  initialOrders: OrderWithRelations[];
}

const ALARM_REPEAT_MS = 8000;

async function fetchOrders(): Promise<OrderWithRelations[]> {
  const res = await fetch("/api/orders", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao buscar pedidos");
  const data = await res.json();
  return data.orders;
}

export function KanbanBoard({ initialOrders }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const knownOrderIds = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const isFirstRun = useRef(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const { data: orders = initialOrders } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    initialData: initialOrders,
    refetchInterval: 5000,
  });

  const pendingNewOrders = orders.filter(
    (o) => o.status === "recebido" && !acknowledgedIds.has(o.id)
  );

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const newOnes = orders.filter(
      (o) => o.status === "recebido" && !knownOrderIds.current.has(o.id)
    );
    if (newOnes.length > 0) {
      playNewOrderSound();
    }
    knownOrderIds.current = new Set(orders.map((o) => o.id));

    // Não deixa acumular ids de pedidos que já saíram de "recebido".
    setAcknowledgedIds((prev) => {
      const stillPending = new Set(
        orders.filter((o) => o.status === "recebido").map((o) => o.id)
      );
      const next = new Set([...prev].filter((id) => stillPending.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [orders]);

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
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      return res.json();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  function handleChangeStatus(orderId: string, status: OrderStatus, previousStatus: OrderStatus) {
    setUpdatingId(orderId);
    statusMutation.mutate(
      { orderId, status },
      {
        onSuccess: () => {
          if (previousStatus === "recebido" && status === "preparando") {
            window.open(
              `/admin/comanda/${orderId}?autoprint=1`,
              "_blank",
              "width=380,height=640"
            );
          }
        },
        onSettled: () => setUpdatingId(null),
      }
    );
  }

  return (
    <div className="h-full overflow-x-auto p-6" onClick={unlockAudio}>
      <div className="flex h-full gap-4">
        {ORDER_STATUSES.map((status) => {
          const columnOrders = orders.filter((o) => o.status === status);
          const colors = ORDER_STATUS_COLORS[status];
          return (
            <div key={status} className="flex w-96 shrink-0 flex-col">
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
                  columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onChangeStatus={handleChangeStatus}
                      onAcknowledge={handleAcknowledge}
                      isUpdating={updatingId === order.id}
                      isNew={order.status === "recebido" && !acknowledgedIds.has(order.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
