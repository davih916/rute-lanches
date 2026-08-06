"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Wallet, TrendingUp, Clock, Flame } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import type { TodayStats } from "@/lib/services/order-service";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        <p className="truncate text-xl font-extrabold text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

export function TodayStatsBar({ stats }: { stats: TodayStats }) {
  const hasTopProducts = stats.topProducts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50/60 px-6 py-4"
    >
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
        />
        <StatCard
          icon={<TrendingUp className="size-5 text-violet-600" />}
          label="Ticket médio"
          value={formatCentsToBRL(stats.averageTicketCents)}
          accent="bg-violet-50"
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
