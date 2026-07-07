"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatCentsToBRL } from "@/lib/money";
import {
  useCartStore,
  getCartSubtotalCents,
  getCartItemLineTotal,
} from "@/store/cart-store";

interface CartDrawerProps {
  minOrderCents: number;
  storeOpen: boolean;
}

export function CartDrawer({ minOrderCents, storeOpen }: CartDrawerProps) {
  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const subtotal = getCartSubtotalCents(items);
  const belowMinimum = minOrderCents > 0 && subtotal > 0 && subtotal < minOrderCents;

  return (
    <Modal open={isOpen} onClose={closeCart} align="bottom" className="flex max-h-[85vh] flex-col">
      <div className="border-b border-neutral-100 p-5 pb-4">
        <h2 className="text-lg font-bold text-neutral-900">Seu carrinho</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Seu carrinho está vazio.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li key={item.cartItemId} className="flex gap-3 border-b border-neutral-100 pb-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900">{item.name}</p>
                  {item.addons.length > 0 && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {item.addons.map((a) => `+ ${a.name}`).join(", ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-xs italic text-neutral-400">&quot;{item.notes}&quot;</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      className="flex size-7 items-center justify-center rounded-full border border-neutral-300 hover:bg-neutral-50"
                      aria-label="Diminuir"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      className="flex size-7 items-center justify-center rounded-full border border-neutral-300 hover:bg-neutral-50"
                      aria-label="Aumentar"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      onClick={() => removeItem(item.cartItemId)}
                      className="ml-2 flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="shrink-0 font-semibold text-neutral-900">
                  {formatCentsToBRL(getCartItemLineTotal(item))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t border-neutral-100 p-5">
          <div className="mb-1 flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatCentsToBRL(subtotal)}</span>
          </div>
          <p className="mb-3 text-xs text-neutral-400">
            + taxa de entrega, calculada no checkout conforme o bairro (grátis na retirada).
          </p>

          {!storeOpen && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-600">
              A loja está fechada no momento.
            </p>
          )}
          {belowMinimum && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-700">
              Pedido mínimo de {formatCentsToBRL(minOrderCents)}.
            </p>
          )}

          {storeOpen && !belowMinimum ? (
            <Link href="/checkout" onClick={closeCart}>
              <Button size="lg" className="w-full">
                Finalizar pedido
              </Button>
            </Link>
          ) : (
            <Button size="lg" className="w-full" disabled>
              Finalizar pedido
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
