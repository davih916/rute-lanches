"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Wallet, TrendingUp, Clock, Flame, Eye, EyeOff } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import type { TodayStats } from "@/lib/services/order-service";

const HIDE_VALUES_STORAGE_KEY = "rl_admin_hide_values";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  masked?: boolean;
}

function StatCard({ icon, label, value, accent, masked }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        <p
          className={`truncate text-xl font-extrabold text-neutral-900 ${
            masked ? "select-none blur-sm" : ""
          }`}
        >
          {masked ? "R$ ••••" : value}
        </p>
      </div>
    </div>
  );
}

export function TodayStatsBar({ stats }: { stats: TodayStats }) {
  const hasTopProducts = stats.topProducts.length > 0;

  // Esconde os valores em dinheiro por padrão — a tela do Kanban fica visível
  // pra qualquer pessoa perto do balcão, não só pro admin. A preferência fica
  // salva no navegador (cada tela/dispositivo lembra o que o usuário escolheu).
  // Lida direto no estado inicial (não em um efeito) pra não piscar o valor
  // "true" por um frame antes de ler o localStorage.
  const [hideValues, setHideValues] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(HIDE_VALUES_STORAGE_KEY);
    return stored === null ? true : stored === "1";
  });

  function toggleHideValues() {
    setHideValues((prev) => {
      const next = !prev;
      window.localStorage.setItem(HIDE_VALUES_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50/60 px-6 py-4"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleHideValues}
          className="flex items-center gap-1.5 self-start rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-500 shadow-sm ring-1 ring-neutral-200 transition-colors hover:text-neutral-700"
        >
          {hideValues ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {hideValues ? "Mostrar valores" : "Ocultar valores"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<ShoppingBag className="size-5 text-blue-600" />}
          label="Pedidos hoje"
          value={String(stats.orderCount)}
          accent="bg-blue-50"
        />
        <StatCard
          icon={<Wallet className="size-5 text-emerald-600" />}
          label="Vendido hoje"
          value={formatCentsToBRL(stats.revenueCents)}
          accent="bg-emerald-50"
          masked={hideValues}
        />
        <StatCard
          icon={<TrendingUp className="size-5 text-violet-600" />}
          label="Ticket médio"
          value={formatCentsToBRL(stats.averageTicketCents)}
          accent="bg-violet-50"
          masked={hideValues}
        />
        <StatCard
          icon={<Clock className="size-5 text-amber-600" />}
          label="Pedidos em aberto"
          value={String(stats.pendingOrders)}
          accent="bg-amber-50"
        />
      </div>

      {hasTopProducts && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-neutral-500">
            <Flame className="size-4 text-orange-500" />
            Mais vendidos hoje:
          </span>
          {stats.topProducts.map((product, i) => (
            <span
              key={product.productId}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm ring-1 ring-neutral-200"
            >
              {i + 1}º {product.name} <span className="text-neutral-400">×{product.quantity}</span>
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
