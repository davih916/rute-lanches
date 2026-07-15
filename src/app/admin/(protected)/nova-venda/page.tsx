import { getSettingsSafe } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods } from "@/lib/constants";
import { listActiveDeliveryZones } from "@/lib/services/delivery-zone-service";
import { listActiveCategoriesWithProducts } from "@/lib/services/category-service";
import { NovaVendaScreen } from "@/components/admin/nova-venda-screen";
import type { CategoryView } from "@/lib/types";

/** Sem bairros cadastrados/banco indisponível, oferece só balcão/retirada (mesmo padrão do checkout do site). */
async function listActiveDeliveryZonesSafe() {
  try {
    return await listActiveDeliveryZones();
  } catch (error) {
    console.error("[nova-venda] Falha ao carregar bairros de entrega — usando lista vazia.", error);
    return [];
  }
}

export default async function NovaVendaPage() {
  const [settings, deliveryZones, categories] = await Promise.all([
    getSettingsSafe(),
    listActiveDeliveryZonesSafe(),
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
      acceptedPaymentMethods={parseAcceptedPaymentMethods(settings.acceptedPaymentMethods)}
      deliveryZones={deliveryZones.map((zone) => ({
        id: zone.id,
        neighborhood: zone.neighborhood,
        feeCents: zone.feeCents,
      }))}
      categories={categoryViews}
    />
  );
}
