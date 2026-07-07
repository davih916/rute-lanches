"use client";

import { ShoppingBag } from "lucide-react";
import { useCartStore, getCartItemCount } from "@/store/cart-store";

interface SiteHeaderProps {
  storeName: string;
  storeOpen: boolean;
}

export function SiteHeader({ storeName, storeOpen }: SiteHeaderProps) {
  const items = useCartStore((s) => s.items);
  const openCart = useCartStore((s) => s.openCart);
  const itemCount = getCartItemCount(items);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--brand-primary)] text-sm font-bold text-white">
            {storeName.charAt(0)}
          </div>
          <div>
            <p className="text-base font-bold leading-none text-neutral-900">{storeName}</p>
            <p
              className="mt-1 text-xs font-medium leading-none"
              style={{ color: storeOpen ? "var(--brand-secondary)" : "#ef4444" }}
            >
              {storeOpen ? "Aberto agora" : "Fechado no momento"}
            </p>
          </div>
        </div>

        <button
          onClick={openCart}
          aria-label="Abrir carrinho"
          className="relative flex size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 transition-colors hover:bg-neutral-200"
        >
          <ShoppingBag className="size-5" />
          {itemCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[11px] font-bold text-white">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
