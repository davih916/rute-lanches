"use client";

import { create } from "zustand";
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

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "cartItemId">) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

function cartItemLineTotal(item: CartItem): number {
  const addonsTotal = item.addons.reduce((sum, a) => sum + a.priceCents, 0);
  return (item.unitPriceCents + addonsTotal) * item.quantity;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      addItem: (item) =>
        set((state) => ({
          items: [
            ...state.items,
            { ...item, cartItemId: crypto.randomUUID() },
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
    { name: "rl-cart", partialize: (state) => ({ items: state.items }) }
  )
);

export function getCartSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + cartItemLineTotal(item), 0);
}

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartItemLineTotal(item: CartItem): number {
  return cartItemLineTotal(item);
}
