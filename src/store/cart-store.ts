"use client";

import { create, type UseBoundStore, type StoreApi } from "zustand";
import { persist } from "zustand/middleware";

export interface CartAddon {
  id: string;
  name: string;
  priceCents: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  unitPriceCents: number;
  imageUrl?: string | null;
  quantity: number;
  notes?: string;
  addons: CartAddon[];
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "cartItemId">) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export type CartStoreHook = UseBoundStore<StoreApi<CartState>>;

/**
 * `crypto.randomUUID()` só existe em contexto seguro (HTTPS/localhost) — numa
 * implantação recém-feita sem domínio/certificado ainda (só `http://IP`), ele
 * não existe e quebra silenciosamente o "adicionar ao carrinho" (a função
 * nem aparece, então nenhum erro chega a aparecer pro usuário). O id só
 * precisa ser único dentro do carrinho local, não precisa ser
 * criptograficamente forte, então um fallback simples resolve.
 */
function generateCartItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cartItemLineTotal(item: CartItem): number {
  const addonsTotal = item.addons.reduce((sum, a) => sum + a.priceCents, 0);
  return (item.unitPriceCents + addonsTotal) * item.quantity;
}

/**
 * Fábrica do carrinho — cada chamada cria uma instância isolada (persistida
 * sob uma chave própria do localStorage). Usada para o carrinho do site
 * (`useCartStore` abaixo) e o carrinho da Venda no Balcão (admin), que não
 * podem compartilhar estado entre si.
 */
export function createCartStore(persistKey: string): CartStoreHook {
  return create<CartState>()(
    persist(
      (set) => ({
        items: [],
        isOpen: false,
        addItem: (item) =>
          set((state) => ({
            items: [
              ...state.items,
              { ...item, cartItemId: generateCartItemId() },
            ],
          })),
        removeItem: (cartItemId) =>
          set((state) => ({
            items: state.items.filter((i) => i.cartItemId !== cartItemId),
          })),
        updateQuantity: (cartItemId, quantity) =>
          set((state) => ({
            items:
              quantity <= 0
                ? state.items.filter((i) => i.cartItemId !== cartItemId)
                : state.items.map((i) =>
                    i.cartItemId === cartItemId ? { ...i, quantity } : i
                  ),
          })),
        clear: () => set({ items: [] }),
        openCart: () => set({ isOpen: true }),
        closeCart: () => set({ isOpen: false }),
      }),
      { name: persistKey, partialize: (state) => ({ items: state.items }) }
    )
  );
}

export const useCartStore = createCartStore("rl-cart");

export function getCartSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + cartItemLineTotal(item), 0);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartItemLineTotal(item: CartItem): number {
  return cartItemLineTotal(item);
}
