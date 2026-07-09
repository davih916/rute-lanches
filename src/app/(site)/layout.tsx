import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CartDrawer } from "@/components/site/cart-drawer";
import { getSettingsSafe } from "@/lib/services/settings-service";
import { isStoreOpenNow } from "@/lib/opening-hours";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettingsSafe();
  const storeOpen = isStoreOpenNow(settings);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <SiteHeader storeName={settings.storeName} storeOpen={storeOpen} />
      <main className="flex-1">{children}</main>
      <SiteFooter
        storeName={settings.storeName}
        address={settings.address}
        whatsapp={settings.whatsapp}
      />
      <CartDrawer minOrderCents={settings.minOrderCents} storeOpen={storeOpen} />
    </div>
  );
}
