"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, UtensilsCrossed, Tags, Settings, Receipt, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Pedidos", icon: LayoutGrid },
  { href: "/admin/produtos", label: "Produtos", icon: UtensilsCrossed },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/fiscal", label: "Fiscal", icon: Receipt },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  adminName: string;
  storeName: string;
}

export function Sidebar({ adminName, storeName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-bold text-white">
          {storeName.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-neutral-900">{storeName}</p>
          <p className="text-xs text-neutral-400">Painel admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                  : "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              <Icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-100 p-3">
        <p className="truncate px-3 py-1 text-xs text-neutral-400">{adminName}</p>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <LogOut className="size-[18px]" />
          Sair
        </button>
      </div>
    </aside>
  );
}
