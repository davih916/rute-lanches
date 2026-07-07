import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/services/order-service";
import { getSettings } from "@/lib/services/settings-service";
import { Comanda } from "@/components/print/comanda";
import { PrintController } from "@/components/print/print-controller";
import type { ReceiptWidth } from "@/lib/constants";

export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrderById(id), getSettings()]);

  if (!order) notFound();

  const receiptWidth = settings.receiptWidth as ReceiptWidth;
  const pageWidth = receiptWidth === "58mm" ? "58mm" : "80mm";

  return (
    <div className="min-h-screen bg-neutral-100">
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${pageWidth} auto; margin: 0; }`,
        }}
      />
      <Suspense>
        <PrintController orderId={order.id} />
      </Suspense>
      <div className="comanda-print-area flex justify-center py-4">
        <Comanda order={order} storeName={settings.storeName} receiptWidth={receiptWidth} />
      </div>
    </div>
  );
}
