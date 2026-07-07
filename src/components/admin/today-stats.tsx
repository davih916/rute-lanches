import { formatCentsToBRL } from "@/lib/money";
import type { TodayStats } from "@/lib/services/order-service";

export function TodayStatsBar({ stats }: { stats: TodayStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 border-b border-neutral-200 bg-white px-6 py-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Pedidos hoje
        </p>
        <p className="text-2xl font-extrabold text-neutral-900">{stats.orderCount}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Vendido hoje
        </p>
        <p className="text-2xl font-extrabold text-neutral-900">
          {formatCentsToBRL(stats.revenueCents)}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          Ticket médio
        </p>
        <p className="text-2xl font-extrabold text-neutral-900">
          {formatCentsToBRL(stats.averageTicketCents)}
        </p>
      </div>
    </div>
  );
}
