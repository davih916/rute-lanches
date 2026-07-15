import Link from "next/link";
import { Plus } from "lucide-react";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { TodayStatsBar } from "@/components/admin/today-stats";
import { Button } from "@/components/ui/button";
import { listOrders, getTodayStats } from "@/lib/services/order-service";

export default async function AdminDashboardPage() {
  const [orders, stats] = await Promise.all([listOrders(), getTodayStats()]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
          <p className="text-sm text-neutral-500">Atualiza automaticamente a cada 5 segundos.</p>
        </div>
        <Link href="/admin/nova-venda">
          <Button size="lg">
            <Plus className="size-4" />
            Nova venda
          </Button>
        </Link>
      </header>
      <TodayStatsBar stats={stats} />
      <div className="flex-1 overflow-hidden">
        <KanbanBoard initialOrders={orders} />
      </div>
    </div>
  );
}
