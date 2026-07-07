"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCentsToBRL } from "@/lib/money";
import { useCartStore } from "@/store/cart-store";
import type { ProductView } from "@/lib/types";

interface ProductModalProps {
  product: ProductView | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  if (!product) return null;

  function toggleAddon(id: string) {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function handleClose() {
    setQuantity(1);
    setNotes("");
    setSelectedAddonIds([]);
    onClose();
  }

  function handleAddToCart() {
    if (!product) return;
    const selectedAddons = product.addons.filter((a) => selectedAddonIds.includes(a.id));
    addItem({
      productId: product.id,
      name: product.name,
      unitPriceCents: product.priceCents,
      imageUrl: product.imageUrl,
      quantity,
      notes: notes.trim() || undefined,
      addons: selectedAddons,
    });
    handleClose();
    openCart();
  }

  const addonsTotal = product.addons
    .filter((a) => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + a.priceCents, 0);
  const lineTotal = (product.priceCents + addonsTotal) * quantity;

  return (
    <Modal open={!!product} onClose={handleClose} align="bottom" className="max-h-[90vh] overflow-y-auto">
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-neutral-100">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-6xl">🍔</div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">{product.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">{product.description}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Ingredientes
          </p>
          <p className="text-sm text-neutral-600">{product.ingredients}</p>
        </div>

        {product.addons.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-800">Adicionais</p>
            <div className="flex flex-col gap-2">
              {product.addons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 hover:bg-neutral-50"
                >
                  <span className="flex items-center gap-2 text-sm text-neutral-800">
                    <input
                      type="checkbox"
                      checked={selectedAddonIds.includes(addon.id)}
                      onChange={() => toggleAddon(addon.id)}
                      className="size-4 accent-[var(--brand-primary)]"
                    />
                    {addon.name}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">
                    + {formatCentsToBRL(addon.priceCents)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Textarea
          label="Observações"
          placeholder="Ex: sem cebola, ponto da carne bem passado..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={300}
        />

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-800">Quantidade</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex size-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              aria-label="Diminuir quantidade"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              className="flex size-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              aria-label="Aumentar quantidade"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <Button size="lg" onClick={handleAddToCart} className="w-full justify-between">
          <span>Adicionar ao carrinho</span>
          <span>{formatCentsToBRL(lineTotal)}</span>
        </Button>
      </div>
    </Modal>
  );
}
