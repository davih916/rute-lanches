import { prisma } from "@/lib/prisma";
import { MenuBrowser } from "@/components/site/menu-browser";
import type { CategoryView } from "@/lib/types";

export default async function HomePage() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { order: "asc" },
        include: {
          addons: { where: { active: true } },
        },
      },
    },
  });

  const categoryViews: CategoryView[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    products: category.products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      ingredients: product.ingredients,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      addons: product.addons.map((addon) => ({
        id: addon.id,
        name: addon.name,
        priceCents: addon.priceCents,
      })),
    })),
  }));

  return <MenuBrowser categories={categoryViews} />;
}
