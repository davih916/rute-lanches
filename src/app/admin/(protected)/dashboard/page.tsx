import Link from "next/link";
import { Plus } from "lucide-react";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { TodayStatsBar } from "@/components/admin/today-stats";
import { BillingReminderBanner } from "@/components/admin/billing-reminder-banner";
import { Button } from "@/components/ui/button";
import { listOrders, listPendingPixPayments, getTodayStats } from "@/lib/services/order-service";
import { getSettings } from "@/lib/services/settings-service";

export default async function AdminDashboardPage() {
  const [orders, pendingPixPayments, stats, settings] = await Promise.all([
    listOrders(),
    listPendingPixPayments(),
    getTodayStats(),
    getSettings(),
  ]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-6 py-4">
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
      <BillingReminderBanner
        storeName={settings.storeName}
        mensalidadePagaEm={settings.mensalidadePagaEm}
        reminderEnabled={settings.mensalidadeReminderEnabled}
      />
      <TodayStatsBar stats={stats} />
      <div className="min-h-0 flex-1 overflow-hidden">
        <KanbanBoard
          initialOrders={orders}
          initialPendingPixPayments={pendingPixPayments}
          storeName={settings.storeName}
        />
      </div>
    </div>
  );
}
