import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getOrderById } from "@/lib/services/order-service";
import { getSettingsSafe } from "@/lib/services/settings-service";
import { Button } from "@/components/ui/button";
import { OrderDetailsCard } from "@/components/site/order-details-card";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrderById(id), getSettingsSafe()]);

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <div
          className="mb-3 flex size-14 items-center justify-center rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-secondary) 12%, white)", color: "var(--brand-secondary)" }}
        >
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900">Pedido enviado!</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Acompanhe o status do seu pedido abaixo. Guarde este link.
        </p>
      </div>

      <OrderDetailsCard initialOrder={order} storeWhatsapp={settings.whatsapp} storeName={settings.storeName} />

      <Link href="/" className="mt-5 block">
        <Button variant="outline" size="lg" className="w-full">
          Voltar ao cardápio
        </Button>
      </Link>
    </div>
  );
}
