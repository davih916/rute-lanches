"use client";

import { useState, useRef, useEffect } from "react";
import { CategoryNav } from "@/components/site/category-nav";
import { ProductCard } from "@/components/site/product-card";
import { ProductModal } from "@/components/site/product-modal";
import type { CategoryView, ProductView } from "@/lib/types";

interface MenuBrowserProps {
  categories: CategoryView[];
}

export function MenuBrowser({ categories }: MenuBrowserProps) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");
  const [selectedProduct, setSelectedProduct] = useState<ProductView | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isClickScrolling = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) setActiveSlug(visible.target.id);
      },
      { rootMargin: "-140px 0px -70% 0px" }
    );

    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [categories]);

  function scrollToCategory(slug: string) {
    setActiveSlug(slug);
    isClickScrolling.current = true;
    sectionRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => (isClickScrolling.current = false), 600);
  }

  if (categories.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-neutral-500">
        Cardápio em atualização. Volte em breve.
      </div>
    );
  }

  return (
    <>
      <CategoryNav
        categories={categories}
        activeSlug={activeSlug}
        onSelect={scrollToCategory}
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6">
        {categories.map((category) => (
          <section
            key={category.id}
            id={category.slug}
            ref={(el) => {
              sectionRefs.current[category.slug] = el;
            }}
            className="scroll-mt-32"
          >
            <h2 className="mb-3 text-lg font-bold text-neutral-900">{category.name}</h2>
            {category.products.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum produto nesta categoria.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {category.products.map((product) => (
                  <ProductCard key={product.id} product={product} onSelect={setSelectedProduct} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </>
  );
}
