import { getSettings } from "@/lib/services/settings-service";
import { getPagBankConfigForAdmin } from "@/lib/services/pagbank-config-service";
import { listDeliveryZonesForAdmin } from "@/lib/services/delivery-zone-service";
import { SettingsForm } from "@/components/admin/settings-form";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { PagBankConfigForm } from "@/components/admin/pagbank-config-form";
import { DeliveryZoneManager } from "@/components/admin/delivery-zone-manager";

export default async function AdminConfiguracoesPage() {
  const [settings, pagbankConfig, zones] = await Promise.all([
    getSettings(),
    getPagBankConfigForAdmin(),
    listDeliveryZonesForAdmin(),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-lg font-bold text-neutral-900">Configurações</h1>
      <SettingsForm settings={settings} />
      <div className="mt-6 max-w-2xl">
        <DeliveryZoneManager
          zones={zones.map((z) => ({
            id: z.id,
            neighborhood: z.neighborhood,
            cepPrefix: z.cepPrefix,
            feeCents: z.feeCents,
            active: z.active,
            visibleToCustomers: z.visibleToCustomers,
            orderCount: z._count.orders,
          }))}
        />
      </div>
      <div className="mt-6 max-w-2xl">
        <PagBankConfigForm config={pagbankConfig} />
      </div>
      <div className="mt-6 max-w-xl">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
