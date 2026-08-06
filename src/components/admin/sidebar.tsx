"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, UtensilsCrossed, Tags, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Pedidos", icon: LayoutGrid },
  { href: "/admin/produtos", label: "Produtos", icon: UtensilsCrossed },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

interface SidebarProps {
  adminName: string;
  storeName: string;
}

function SidebarContent({
  adminName,
  storeName,
  pathname,
  onNavigate,
  onLogout,
}: SidebarProps & { pathname: string | null; onNavigate?: () => void; onLogout: () => void }) {
  return (
    <>
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
              onClick={onNavigate}
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
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <LogOut className="size-[18px]" />
          Sair
        </button>
      </div>
    </>
  );
}

export function Sidebar({ adminName, storeName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra superior — só aparece em telas pequenas (celular/tablet retrato). */}
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex size-7 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-bold text-white">
          {storeName.charAt(0)}
        </div>
        <p className="truncate text-sm font-bold text-neutral-900">{storeName}</p>
      </header>

      {/* Sidebar fixa — desktop. */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
        <SidebarContent
          adminName={adminName}
          storeName={storeName}
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>

      {/* Gaveta deslizante — mobile. */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl md:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="absolute right-3 top-4 rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-4" />
              </button>
              <SidebarContent
                adminName={adminName}
                storeName={storeName}
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
                onLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
