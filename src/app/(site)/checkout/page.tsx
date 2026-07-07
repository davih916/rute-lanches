import { CheckoutForm } from "@/components/site/checkout-form";
import { getSettings } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods } from "@/lib/constants";
import { listActiveDeliveryZones } from "@/lib/services/delivery-zone-service";

export default async function CheckoutPage() {
  const [settings, deliveryZones] = await Promise.all([
    getSettings(),
    listActiveDeliveryZones(),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-neutral-900">Finalizar pedido</h1>
      <CheckoutForm
        storeOpen={isStoreOpenNow(settings)}
        acceptedPaymentMethods={parseAcceptedPaymentMethods(settings.acceptedPaymentMethods)}
        deliveryZones={deliveryZones.map((zone) => ({
          id: zone.id,
          neighborhood: zone.neighborhood,
          feeCents: zone.feeCents,
        }))}
      />
    </div>
  );
}
