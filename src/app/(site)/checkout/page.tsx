import { CheckoutForm } from "@/components/site/checkout-form";
import { getSettingsSafe } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";
import { parseAcceptedPaymentMethods } from "@/lib/constants";

export default async function CheckoutPage() {
  const settings = await getSettingsSafe();

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-5 text-xl font-bold text-neutral-900">Finalizar pedido</h1>
      <CheckoutForm
        storeOpen={isStoreOpenNow(settings)}
        acceptedPaymentMethods={parseAcceptedPaymentMethods(settings.acceptedPaymentMethods)}
        storeWhatsapp={settings.whatsapp}
        storeName={settings.storeName}
      />
    </div>
  );
}
