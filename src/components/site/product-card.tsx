"use client";

import Image from "next/image";
import { Plus } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money";
import type { ProductView } from "@/lib/types";

interface ProductCardProps {
  product: ProductView;
  onSelect: (product: ProductView) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <button
      onClick={() => onSelect(product)}
      className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-left transition-all hover:border-neutral-300 hover:shadow-md active:scale-[0.99]"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl">🍔</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-neutral-900">{product.name}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-neutral-500">{product.description}</p>
        <p className="mt-1.5 font-bold text-neutral-900">{formatCentsToBRL(product.priceCents)}</p>
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
        <Plus className="size-4" />
      </div>
    </button>
  );
}
