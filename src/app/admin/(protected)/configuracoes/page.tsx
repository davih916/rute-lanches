import { getSettings } from "@/lib/services/settings-service";
import { listDeliveryZonesForAdmin } from "@/lib/services/delivery-zone-service";
import { SettingsForm } from "@/components/admin/settings-form";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { DeliveryZoneManager } from "@/components/admin/delivery-zone-manager";

export default async function AdminConfiguracoesPage() {
  const [settings, zones] = await Promise.all([getSettings(), listDeliveryZonesForAdmin()]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-bold text-neutral-900">Configurações</h1>
      <SettingsForm settings={settings} />
      <div className="mt-6 max-w-xl">
        <DeliveryZoneManager
          zones={zones.map((zone) => ({
            id: zone.id,
            neighborhood: zone.neighborhood,
            feeCents: zone.feeCents,
            active: zone.active,
            orderCount: zone._count.orders,
          }))}
        />
      </div>
      <div className="mt-6 max-w-xl">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
