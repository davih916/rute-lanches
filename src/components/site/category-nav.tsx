"use client";

interface CategoryNavProps {
  categories: { id: string; name: string; slug: string }[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export function CategoryNav({ categories, activeSlug, onSelect }: CategoryNavProps) {
  return (
    <div className="sticky top-[65px] z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelect(category.slug)}
            className={
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
              (activeSlug === category.slug
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200")
            }
          >
            {category.name}
          </button>
        ))}
      </div>
    </div>
  );
}
