import { listActiveCategoriesWithProducts } from "@/lib/services/category-service";
import { MenuBrowser } from "@/components/site/menu-browser";
import type { CategoryView } from "@/lib/types";

/**
 * Se o banco estiver inacessível (DATABASE_URL ausente/errada, migrations
 * não aplicadas), cai para cardápio vazio em vez de derrubar a página com
 * erro 500 — o MenuBrowser já trata lista vazia com a mensagem "Cardápio em
 * atualização".
 */
async function getCategoriesSafe() {
  try {
    return await listActiveCategoriesWithProducts();
  } catch (error) {
    console.error(
      "[home] Falha ao carregar cardápio — verifique DATABASE_URL e se as migrations foram aplicadas (prisma migrate deploy).",
      error
    );
    return [];
  }
}

export default async function HomePage() {
  const categories = await getCategoriesSafe();

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
