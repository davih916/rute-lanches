import { getSettingsSafe } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods } from "@/lib/constants";
import { listActiveCategoriesWithProducts } from "@/lib/services/category-service";
import { NovaVendaScreen } from "@/components/admin/nova-venda-screen";
import type { CategoryView } from "@/lib/types";

export default async function NovaVendaPage() {
  const [settings, categories] = await Promise.all([
    getSettingsSafe(),
    listActiveCategoriesWithProducts(),
  ]);

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

  return (
    <NovaVendaScreen
      storeOpen={isStoreOpenNow(settings)}
      // "Combinar pelo WhatsApp" não faz sentido numa venda presencial (cliente já está no balcão).
      acceptedPaymentMethods={parseAcceptedPaymentMethods(settings.acceptedPaymentMethods).filter(
        (method) => method !== "whatsapp"
      )}
      categories={categoryViews}
    />
  );
}
