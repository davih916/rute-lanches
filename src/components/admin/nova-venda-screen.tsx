"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ProductCard } from "@/components/site/product-card";
import { ProductModal } from "@/components/site/product-modal";
import { CheckoutForm } from "@/components/site/checkout-form";
import { PixPaymentPanel } from "@/components/site/pix-payment-panel";
import { Button } from "@/components/ui/button";
import { useBalcaoCartStore } from "@/store/balcao-cart-store";
import type { CategoryView, ProductView } from "@/lib/types";
import type { PaymentMethod } from "@/lib/constants";

interface DeliveryZoneOption {
  id: string;
  neighborhood: string;
  feeCents: number;
}

interface NovaVendaScreenProps {
  storeOpen: boolean;
  acceptedPaymentMethods: PaymentMethod[];
  deliveryZones: DeliveryZoneOption[];
  categories: CategoryView[];
}

interface CreatedOrder {
  id: string;
  paymentMethod: string;
}

export function NovaVendaScreen({
  storeOpen,
  acceptedPaymentMethods,
  deliveryZones,
  categories,
}: NovaVendaScreenProps) {
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductView | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const clearCart = useBalcaoCartStore((s) => s.clear);

  const allProducts = useMemo(() => categories.flatMap((c) => c.products), [categories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return allProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [allProducts, search]);

  function handleNewSale() {
    clearCart();
    setCreatedOrder(null);
  }

  if (createdOrder) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="mb-4 flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="size-6" />
          <p className="text-lg font-bold">Venda registrada!</p>
        </div>

        {createdOrder.paymentMethod === "pix" ? (
          <PixPaymentPanel orderId={createdOrder.id} />
        ) : (
          <p className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
            Pedido criado e já aparece no painel de pedidos.
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button onClick={handleNewSale} size="lg" className="flex-1">
            Nova venda
          </Button>
          <Link href="/admin/dashboard" className="flex-1">
            <Button variant="outline" size="lg" className="w-full">
              Ver pedidos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex w-1/2 flex-col border-r border-neutral-200 p-6">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-neutral-400 hover:text-neutral-600">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-bold text-neutral-900">Nova Venda</h1>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar produto pelo nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-9 pr-3.5 text-sm outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {search.trim() === "" ? (
            <p className="pt-8 text-center text-sm text-neutral-400">Digite para buscar um produto.</p>
          ) : filteredProducts.length === 0 ? (
            <p className="pt-8 text-center text-sm text-neutral-400">Nenhum produto encontrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-1/2 overflow-y-auto p-6">
        <CheckoutForm
          storeOpen={storeOpen}
          acceptedPaymentMethods={acceptedPaymentMethods}
          deliveryZones={deliveryZones}
          useCartStoreHook={useBalcaoCartStore}
          deliveryTypeOptions={["balcao", "retirada", "entrega"]}
          requireCustomerContact={false}
          submitLabel="Finalizar venda"
          redirectIfEmpty={false}
          onOrderCreated={setCreatedOrder}
        />
      </div>

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        useCartStoreHook={useBalcaoCartStore}
      />
    </div>
  );
}
