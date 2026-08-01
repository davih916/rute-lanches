import { CheckoutForm } from "@/components/site/checkout-form";
import { getSettingsSafe } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods } from "@/lib/constants";
import { listActiveDeliveryZones } from "@/lib/services/delivery-zone-service";

/** Sem bairros cadastrados/banco indisponível, o checkout só oferece retirada (comportamento já existente). */
async function listActiveDeliveryZonesSafe() {
  try {
    return await listActiveDeliveryZones();
  } catch (error) {
    console.error("[checkout] Falha ao carregar bairros de entrega — usando lista vazia.", error);
    return [];
  }
}

export default async function CheckoutPage() {
  const [settings, deliveryZones] = await Promise.all([
    getSettingsSafe(),
    listActiveDeliveryZonesSafe(),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-neutral-900">Finalizar pedido</h1>
      <CheckoutForm
        storeOpen={isStoreOpenNow(settings)}
        acceptedPaymentMethods={parseAcceptedPaymentMethods(settings.acceptedPaymentMethods)}
        storeWhatsapp={settings.whatsapp}
        storeName={settings.storeName}
        deliveryZones={deliveryZones.map((zone) => ({
          id: zone.id,
          neighborhood: zone.neighborhood,
          feeCents: zone.feeCents,
        }))}
      />
    </div>
  );
}
